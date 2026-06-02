/**
 * Clarification Questions Agent
 *
 * Analyzes extracted requirements to identify ambiguities, contradictions,
 * and missing information. Generates formal RFI (Request for Information)
 * questions for submission to the client.
 */

import { db } from "@/lib/prisma";
import { downloadFromS3, getProcessedContentKey } from "@/lib/s3";
import { anthropic, MODELS, calculateCost, withRetry } from "@/lib/ai/client";
import {
  getClarificationQuestionsSystemPrompt,
} from "@/lib/ai/prompts/draft-section";
import type { ContentLanguage } from "@prisma/client";

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
      anthropic.messages.create({
        model: MODELS.CLAUDE_SONNET,
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      })
    );

    await db.aIJob.update({
      where: { id: jobId },
      data: { progress: 80 },
    });

    // Parse response
    const text = response.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { type: "text"; text: string }).text)
      .join("");

    const jsonMatch =
      text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ??
      text.match(/(\{[\s\S]*\})/);

    let questions: ClarificationQuestion[] = [];
    try {
      const parsed: ClarificationResult = JSON.parse(
        jsonMatch ? jsonMatch[1] : text
      );
      questions = parsed.questions ?? [];
    } catch {
      console.warn("[clarification] Failed to parse response JSON");
    }

    const cost = calculateCost(
      MODELS.CLAUDE_SONNET,
      response.usage.input_tokens,
      response.usage.output_tokens
    );

    await db.aIJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        progress: 100,
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
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
