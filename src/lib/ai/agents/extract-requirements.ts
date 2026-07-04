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

// Max chars per chunk. Kept modest so each extraction call finishes comfortably
// within the per-call timeout — a 60k chunk + 8k structured output could take
// >75s and get cut (the API itself is fast; the heavy per-chunk call was not).
const MAX_CHUNK_CHARS = 30_000; // ~7.5K tokens
const CHUNK_OVERLAP_CHARS = 1_000;

/** Bound any promise so a hung I/O call can't stall to the function-reaping wall. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms)),
  ]);
}

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

    // ── 2. Extract requirements — collect chunk tasks across all docs, then run
    //       them with BOUNDED CONCURRENCY. Sequential per-chunk calls made a big
    //       RFP crawl (and sit at 10% until the first chunk returned); N workers
    //       pulling from a shared queue is ~Nx faster and advances progress as
    //       each chunk finishes. ─────────────────────────────────────────────
    const allRequirements: ExtractedRequirement[] = [];

    interface ChunkTask {
      chunk: string;
      chunkIdx: number;
      chunkCount: number;
      systemPrompt: string;
      tenderType: string;
    }
    const tasks: ChunkTask[] = [];

    // Marker: reached the content-download stage. A stall's progress value now
    // pinpoints WHERE it stopped (10 = before download, 12 = in download, 15 = extracting).
    await db.aIJob.update({ where: { id: jobId }, data: { progress: 12 } }).catch(() => {});

    for (const doc of documents) {
      const contentKey = getProcessedContentKey(doc.id);
      let content: ProcessedContent;
      try {
        // Bounded: a hung storage download must not sit until the 300s reaping wall
        // (this is the pre-LLM path that produced "stuck at 10%").
        const buffer = await withTimeout(downloadFromS3(contentKey), 30_000, "document content download");
        content = JSON.parse(buffer.toString("utf-8"));
      } catch (e) {
        console.warn(`[extraction] Could not load content for doc ${doc.id} — skipping:`, e instanceof Error ? e.message : e);
        continue;
      }

      const docLanguage = (doc.languageDetected?.toLowerCase() ?? "en") as "en" | "ar" | "bilingual";
      const systemPrompt = getExtractionSystemPrompt({
        language: docLanguage === "bilingual" ? "bilingual" : docLanguage === "ar" ? "ar" : "en",
        documentType: tender?.tenderType ?? "RFP",
        sector: undefined,
      });

      const chunks = chunkText(content.fullText, MAX_CHUNK_CHARS, CHUNK_OVERLAP_CHARS);
      console.log(`[extraction] Doc ${doc.id}: ${content.fullText.length} chars → ${chunks.length} chunk(s)`);
      chunks.forEach((chunk, chunkIdx) =>
        tasks.push({ chunk, chunkIdx, chunkCount: chunks.length, systemPrompt, tenderType: tender?.tenderType ?? "RFP" })
      );
    }

    // Fail loudly if NO content could be read (download failed/timed out) — never
    // hang or silently "complete" with zero requirements.
    if (tasks.length === 0) {
      throw new Error(
        "Could not read the processed document content (storage download failed or timed out). Please re-upload the document and try again."
      );
    }
    await db.aIJob.update({ where: { id: jobId }, data: { progress: 15 } }).catch(() => {});

    const EXTRACTION_CONCURRENCY = 4;
    // Hard per-call cap. Without it a hung LLM call sits until the 300s function
    // reaping wall, leaving the job at 10% forever with no error (the bug).
    const CHUNK_TIMEOUT_MS = 90_000;
    let completedChunks = 0;
    let failedChunks = 0;
    const queue = [...tasks];

    async function callModel(task: ChunkTask, model: ReturnType<typeof getChatModel>) {
      const userMessage = getExtractionUserMessage(
        task.chunk,
        task.tenderType,
        task.chunkCount > 1 ? task.chunkIdx : undefined,
        task.chunkCount > 1 ? task.chunkCount : undefined
      );
      return withRetry(() =>
        generateObject({
          model,
          schema: ExtractionResultSchema,
          schemaName: "extracted_requirements",
          temperature: 0,
          maxOutputTokens: 6000,
          system: task.systemPrompt,
          prompt: userMessage,
          abortSignal: AbortSignal.timeout(CHUNK_TIMEOUT_MS),
        })
      );
    }

    async function runChunk(task: ChunkTask): Promise<void> {
      try {
        // Fast/cheap Haiku first; on ANY failure (incl. a timeout/hang) fall back to
        // the default model — the one every other agent uses reliably.
        let result;
        try {
          result = await callModel(task, getChatModel(MODELS.CLAUDE_HAIKU));
        } catch (haikuErr) {
          console.warn(
            `[extraction] chunk ${task.chunkIdx + 1}/${task.chunkCount} — Haiku failed (${haikuErr instanceof Error ? haikuErr.message : haikuErr}); retrying on the default model`
          );
          result = await callModel(task, getChatModel());
        }
        totalPromptTokens += result.usage.inputTokens ?? 0;
        totalCompletionTokens += result.usage.outputTokens ?? 0;
        allRequirements.push(...((result.object.requirements ?? []) as ExtractedRequirement[]));
      } catch (err) {
        // Both models failed for this chunk — skip it (partial results beat total
        // failure) but count it so we can fail the job if NOTHING was extracted.
        failedChunks++;
        console.error(
          `[extraction] chunk ${task.chunkIdx + 1}/${task.chunkCount} failed on both models:`,
          err instanceof Error ? err.message : err
        );
      } finally {
        completedChunks++;
        const overallProgress = Math.round(10 + (tasks.length ? completedChunks / tasks.length : 1) * 60);
        await db.aIJob.update({ where: { id: jobId }, data: { progress: overallProgress } }).catch(() => {});
      }
    }

    // N workers pull from the shared queue until it drains (single-threaded event
    // loop → the shared counters/array mutate safely between awaits).
    await Promise.all(
      Array.from({ length: Math.min(EXTRACTION_CONCURRENCY, queue.length) }, async () => {
        for (let task = queue.shift(); task; task = queue.shift()) {
          await runChunk(task);
        }
      })
    );

    // If EVERY chunk failed, the model is unavailable/timing out — fail LOUDLY with a
    // clear message instead of hanging or "completing" with zero requirements.
    if (tasks.length > 0 && allRequirements.length === 0) {
      throw new Error(
        `Extraction failed: the AI model timed out or errored on all ${tasks.length} document section(s). ` +
          `Please try again — if it persists, the document may be too large or the model temporarily unavailable.`
      );
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

    // Reached the end of the text — stop. Without this, `start = breakPoint -
    // overlap` parks at `length - overlap` and the loop spins forever on the tail:
    // a SYNCHRONOUS infinite loop that blocks the event loop. THIS is what actually
    // froze extraction at ~10% with no error and no timeout firing (a blocked event
    // loop can't run setTimeout, so none of the async timeouts could fire).
    if (breakPoint >= text.length) break;

    // Always advance — never re-process the same window.
    const nextStart = breakPoint - overlap;
    start = nextStart > start ? nextStart : breakPoint;
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
