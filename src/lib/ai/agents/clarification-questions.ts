/**
 * Clarification Questions Agent
 *
 * Analyzes extracted requirements to identify ambiguities, contradictions,
 * and missing information. Generates formal RFI (Request for Information)
 * questions for submission to the client.
 */

import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { downloadFromS3, getProcessedContentKey } from "@/lib/s3";
import { MODELS, calculateCost, withRetry } from "@/lib/ai/client";
import { getChatModel } from "@/lib/ai/llm-provider";
import {
  getClarificationQuestionsSystemPrompt,
} from "@/lib/ai/prompts/draft-section";
import type { ContentLanguage } from "@prisma/client";

const ClarificationResultSchema = z.object({
  questions: z.array(
    z.object({
      number: z.number(),
      section_ref: z.string(),
      question_en: z.string(),
      question_ar: z.string().nullable(),
      reason: z.string(),
    })
  ),
});

interface ClarificationQuestion {
  number: number;
  section_ref: string;
  question_en: string;
  question_ar: string | null;
  reason: string;
}

interface ClarificationResult {
  questions: ClarificationQuestion[];
}

/**
 * Generate clarification questions for a tender.
 * Analyzes both the document text and extracted requirements.
 */
export async function runClarificationAgent(
  jobId: string,
  tenderId: string,
  orgId: string
): Promise<{ questions: ClarificationQuestion[] }> {
  const startTime = Date.now();

  await db.aIJob.update({
    where: { id: jobId },
    data: { status: "PROCESSING", progress: 10 },
  });

  try {
    const [tender, requirements, primaryDoc] = await Promise.all([
      db.tender.findUnique({
        where: { id: tenderId },
        select: { titleEn: true, titleAr: true, primaryLanguage: true, tenderType: true },
      }),
      db.requirement.findMany({
        where: {
          tenderId,
          requirementType: { in: ["MANDATORY", "CONDITIONAL"] },
          deletedAt: null,
        },
        select: { textEn: true, textAr: true, sectionRef: true, priority: true },
        orderBy: [{ priority: "asc" }],
        take: 50,
      }),
      db.document.findFirst({
        where: { tenderId, isPrimary: true, processingStatus: "READY" },
        select: { id: true, languageDetected: true },
      }),
    ]);

    if (!tender) throw new Error("Tender not found");

    // Load document text for deeper analysis
    let documentExcerpt = "";
    if (primaryDoc) {
      try {
        const contentKey = getProcessedContentKey(primaryDoc.id);
        const buffer = await downloadFromS3(contentKey);
        const content = JSON.parse(buffer.toString("utf-8"));
        // Use first 20,000 chars for clarification analysis
        documentExcerpt = content.fullText?.slice(0, 20_000) ?? "";
      } catch {
        // Fall back to requirements-only analysis
      }
    }

    const language =
      (tender.primaryLanguage as ContentLanguage) ?? "EN";

    const systemPrompt = getClarificationQuestionsSystemPrompt(
      tender.titleEn + (tender.titleAr ? ` / ${tender.titleAr}` : ""),
      language
    );

    const requirementsList = requirements
      .slice(0, 30)
      .map(
        (r, i) =>
          `[${i + 1}] ${r.sectionRef ? `(${r.sectionRef}) ` : ""}${r.textEn}`
      )
      .join("\n");

    const userMessage = `Analyze the following tender and identify requirements that need clarification.

TENDER: ${tender.titleEn}
TYPE: ${tender.tenderType ?? "RFP"}

EXTRACTED REQUIREMENTS (focus on ambiguous ones):
${requirementsList}

${
  documentExcerpt
    ? `DOCUMENT EXCERPT (for additional context):\n${documentExcerpt.slice(0, 8000)}`
    : ""
}

Generate up to 15 clarification questions. Return ONLY valid JSON: { "questions": [...] }`;

    await db.aIJob.update({
      where: { id: jobId },
      data: { progress: 40 },
    });

    const response = await withRetry(() =>
      generateObject({
        model: getChatModel(), // Claude (cloud) or local vLLM
        schema: ClarificationResultSchema,
        schemaName: "clarification_questions",
        temperature: 0,
        maxOutputTokens: 4000,
        system: systemPrompt,
        prompt: userMessage,
      })
    );

    await db.aIJob.update({
      where: { id: jobId },
      data: { progress: 80 },
    });

    const questions: ClarificationQuestion[] = (response.object.questions ??
      []) as ClarificationQuestion[];
    const inTok = response.usage.inputTokens ?? 0;
    const outTok = response.usage.outputTokens ?? 0;

    const cost = calculateCost(MODELS.CLAUDE_SONNET, inTok, outTok);

    await db.aIJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        progress: 100,
        promptTokens: inTok,
        completionTokens: outTok,
        totalTokens: inTok + outTok,
        costUsd: cost,
        latencyMs: Date.now() - startTime,
        resultRef: JSON.stringify({ questions }),
        outputMetadata: { questionsGenerated: questions.length },
      },
    });

    console.log(
      `[clarification] ✅ Job ${jobId}: ${questions.length} questions, $${cost.toFixed(6)}`
    );

    return { questions };
  } catch (err) {
    console.error(`[clarification] ❌ Job ${jobId} failed:`, err);
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
