/**
 * Requirement Extraction Agent
 *
 * Downloads processed document content from S3, chunks it if large,
 * calls Claude with structured output (tool_use), deduplicates results,
 * saves requirements to DB, and creates compliance matrix rows.
 */

import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { downloadFromS3, getProcessedContentKey } from "@/lib/s3";
import { MODELS, calculateCost, withRetry } from "@/lib/ai/client";
import { getChatModel } from "@/lib/ai/llm-provider";
import {
  getExtractionSystemPrompt,
  getExtractionUserMessage,
} from "@/lib/ai/prompts/extract-requirements";
import type { ProcessedContent } from "@/lib/document-processing/pipeline";

const ExtractionResultSchema = z.object({
  requirements: z.array(
    z.object({
      text_en: z.string(),
      text_ar: z.string().nullable(),
      section_ref: z.string().nullable(),
      page_ref: z.number().nullable(),
      requirement_type: z.string(),
      priority: z.string(),
      confidence_score: z.number(),
      tags: z.array(z.string()),
    })
  ),
});

interface ExtractedRequirement {
  text_en: string;
  text_ar: string | null;
  section_ref: string | null;
  page_ref: number | null;
  requirement_type: string;
  priority: string;
  confidence_score: number;
  tags: string[];
}

interface ExtractionResult {
  requirements: ExtractedRequirement[];
  summary: {
    total: number;
    mandatory: number;
    critical: number;
    language: string;
  };
}

// Max chars per chunk to stay within Claude's token budget
const MAX_CHUNK_CHARS = 60_000; // ~15K tokens
const CHUNK_OVERLAP_CHARS = 2_000;

/**
 * Main extraction function — called by the processing pipeline.
 * Creates requirements + compliance matrix rows in the DB.
 */
export async function runExtractionAgent(
  jobId: string,
  tenderId: string,
  documentIds: string[],
  orgId: string
): Promise<void> {
  const startTime = Date.now();
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  await db.aIJob.update({
    where: { id: jobId },
    data: { status: "PROCESSING", progress: 5 },
  });

  try {
    // ── 1. Load all documents' processed content ──────────────────────────────
    const documents = await db.document.findMany({
      where: {
        id: { in: documentIds },
        tenderId,
        processingStatus: "READY",
        deletedAt: null,
      },
      select: {
        id: true,
        originalFilename: true,
        languageDetected: true,
        pageCount: true,
        mimeType: true,
      },
    });

    if (documents.length === 0) {
      throw new Error(
        "No processed documents found. Please wait for document processing to complete."
      );
    }

    const tender = await db.tender.findUnique({
      where: { id: tenderId },
      select: { titleEn: true, tenderType: true, primaryLanguage: true },
    });

    await db.aIJob.update({
      where: { id: jobId },
      data: { progress: 10 },
    });

    // ── 2. Extract requirements from each document ─────────────────────────────
    const allRequirements: ExtractedRequirement[] = [];
    let docIndex = 0;

    for (const doc of documents) {
      // Load processed content from S3
      const contentKey = getProcessedContentKey(doc.id);
      let content: ProcessedContent;

      try {
        const buffer = await downloadFromS3(contentKey);
        content = JSON.parse(buffer.toString("utf-8"));
      } catch {
        console.warn(`[extraction] Could not load content for doc ${doc.id} — skipping`);
        continue;
      }

      const fullText = content.fullText;
      const docLanguage = (doc.languageDetected?.toLowerCase() ?? "en") as
        | "en"
        | "ar"
        | "bilingual";

      const systemPrompt = getExtractionSystemPrompt({
        language: docLanguage === "bilingual" ? "bilingual" : docLanguage === "ar" ? "ar" : "en",
        documentType: tender?.tenderType ?? "RFP",
        sector: undefined,
      });

      // ── Chunk the document if large ────────────────────────────────────────
      const chunks = chunkText(fullText, MAX_CHUNK_CHARS, CHUNK_OVERLAP_CHARS);
      console.log(
        `[extraction] Doc ${doc.id}: ${fullText.length} chars → ${chunks.length} chunk(s)`
      );

      for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
        const chunk = chunks[chunkIdx];
        const userMessage = getExtractionUserMessage(
          chunk,
          tender?.tenderType ?? "RFP",
          chunks.length > 1 ? chunkIdx : undefined,
          chunks.length > 1 ? chunks.length : undefined
        );

        const result = await withRetry(() =>
          generateObject({
            model: getChatModel(MODELS.CLAUDE_HAIKU), // cloud Haiku or local vLLM
            schema: ExtractionResultSchema,
            schemaName: "extracted_requirements",
            temperature: 0,
            maxOutputTokens: 8000,
            system: systemPrompt,
            prompt: userMessage,
          })
        );

        totalPromptTokens += result.usage.inputTokens ?? 0;
        totalCompletionTokens += result.usage.outputTokens ?? 0;
        allRequirements.push(...((result.object.requirements ?? []) as ExtractedRequirement[]));

        // Update progress
        const overallProgress = Math.round(
          10 +
            ((docIndex + (chunkIdx + 1) / chunks.length) / documents.length) *
              60
        );
        await db.aIJob.update({
          where: { id: jobId },
          data: { progress: overallProgress },
        });
      }

      docIndex++;
    }

    // ── 3. Deduplicate requirements ────────────────────────────────────────────
    const deduplicated = deduplicateRequirements(allRequirements);
    console.log(
      `[extraction] Total: ${allRequirements.length} → deduped: ${deduplicated.length}`
    );

    await db.aIJob.update({
      where: { id: jobId },
      data: { progress: 75 },
    });

    // ── 4. Save requirements to DB ─────────────────────────────────────────────
    // Clear existing AI-extracted requirements for this tender first
    await db.requirement.updateMany({
      where: { tenderId, isAiExtracted: true, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    // Also clear their compliance rows
    const existingReqs = await db.requirement.findMany({
      where: { tenderId, deletedAt: { not: null } },
      select: { id: true },
    });

    if (existingReqs.length > 0) {
      await db.complianceMatrixRow.deleteMany({
        where: { requirementId: { in: existingReqs.map((r) => r.id) } },
      });
    }

    // Bulk create new requirements
    const createdRequirements = await Promise.all(
      deduplicated.map((req) =>
        db.requirement.create({
          data: {
            tenderId,
            orgId,
            textEn: req.text_en,
            textAr: req.text_ar ?? null,
            sectionRef: req.section_ref ?? null,
            pageRef: req.page_ref ?? null,
            requirementType: mapRequirementType(req.requirement_type),
            priority: mapPriority(req.priority),
            confidenceScore: Math.min(1, Math.max(0, req.confidence_score)),
            isAiExtracted: true,
            tags: req.tags ?? [],
          },
        })
      )
    );

    await db.aIJob.update({
      where: { id: jobId },
      data: { progress: 85 },
    });

    // ── 5. Create compliance matrix rows ──────────────────────────────────────
    // One row per requirement, all initially NOT_STARTED
    await db.complianceMatrixRow.createMany({
      data: createdRequirements.map((req) => ({
        tenderId,
        requirementId: req.id,
        orgId,
        status: "NOT_STARTED",
      })),
      skipDuplicates: true,
    });

    // ── 6. Finalize job ────────────────────────────────────────────────────────
    const cost = calculateCost(
      MODELS.CLAUDE_HAIKU,
      totalPromptTokens,
      totalCompletionTokens
    );
    const latencyMs = Date.now() - startTime;

    await db.aIJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        progress: 100,
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
        costUsd: cost,
        latencyMs,
        outputMetadata: {
          requirementsExtracted: createdRequirements.length,
          mandatory: createdRequirements.filter(
            (r) => r.requirementType === "MANDATORY"
          ).length,
          critical: createdRequirements.filter(
            (r) => r.priority === "CRITICAL"
          ).length,
        },
      },
    });

    console.log(
      `[extraction] ✅ Job ${jobId}: ${createdRequirements.length} requirements, ` +
        `${latencyMs}ms, $${cost.toFixed(6)}`
    );
  } catch (err) {
    console.error(`[extraction] ❌ Job ${jobId} failed:`, err);
    await db.aIJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : String(err),
        latencyMs: Date.now() - startTime,
      },
    });
    throw err;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function chunkText(
  text: string,
  maxChars: number,
  overlap: number
): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);

    // Try to break at a paragraph boundary
    let breakPoint = end;
    if (end < text.length) {
      const lastNewline = text.lastIndexOf("\n\n", end);
      if (lastNewline > start + maxChars * 0.5) {
        breakPoint = lastNewline + 2;
      }
    }

    chunks.push(text.slice(start, breakPoint));
    start = breakPoint - overlap;
  }

  return chunks;
}

function deduplicateRequirements(
  reqs: ExtractedRequirement[]
): ExtractedRequirement[] {
  const seen = new Set<string>();
  return reqs.filter((req) => {
    // Normalize for comparison: lowercase, remove extra spaces, first 150 chars
    const key = req.text_en.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 150);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapRequirementType(type: string) {
  const map: Record<string, string> = {
    mandatory: "MANDATORY",
    optional: "OPTIONAL",
    informational: "INFORMATIONAL",
    conditional: "CONDITIONAL",
  };
  return (map[type.toLowerCase()] ?? "MANDATORY") as any;
}

function mapPriority(priority: string) {
  const map: Record<string, string> = {
    critical: "CRITICAL",
    high: "HIGH",
    medium: "MEDIUM",
    low: "LOW",
  };
  return (map[priority.toLowerCase()] ?? "HIGH") as any;
}
