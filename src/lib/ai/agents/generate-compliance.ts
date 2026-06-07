/**
 * Compliance Matrix Generation Agent
 *
 * Takes all extracted requirements for a tender and:
 * 1. Maps each requirement to the most relevant proposal section
 * 2. Generates a brief template response for each requirement
 * 3. Updates compliance matrix rows in the DB
 */

import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { MODELS, calculateCost, withRetry } from "@/lib/ai/client";
import { getChatModel } from "@/lib/ai/llm-provider";
import type { SectionType } from "@prisma/client";

const ComplianceMappingSchema = z.object({
  mappings: z.array(
    z.object({
      requirement_id: z.string(),
      section: z.string(),
      response_template_en: z.string(),
      response_template_ar: z.string().nullable(),
    })
  ),
});

const COMPLIANCE_SYSTEM_PROMPT = `You are a senior technical proposal writer mapping tender requirements to proposal sections.

For each requirement provided, you must:
1. Identify which proposal section best addresses it
2. Write a brief (2-3 sentence) template response that directly addresses the requirement
3. Assign a compliance status suggestion

Available sections:
- EXECUTIVE_SUMMARY
- COMPANY_OVERVIEW
- TECHNICAL_APPROACH
- METHODOLOGY
- WORK_PLAN
- TEAM_QUALIFICATIONS
- PAST_PERFORMANCE
- EQUIPMENT_RESOURCES
- HEALTH_SAFETY
- LOCAL_CONTENT
- FINANCIAL_PROPOSAL
- CLARIFICATIONS
- APPENDIX

Return ONLY a valid JSON object with the structure shown. No preamble.`;

interface ComplianceMappingResult {
  mappings: Array<{
    requirement_id: string;
    section: string;
    response_template_en: string;
    response_template_ar: string | null;
  }>;
}

/**
 * Map requirements to proposal sections and generate template responses.
 * Processes in batches of 20 to stay within token limits.
 */
export async function runComplianceAgent(
  jobId: string,
  tenderId: string,
  orgId: string
): Promise<void> {
  const startTime = Date.now();

  await db.aIJob.update({
    where: { id: jobId },
    data: { status: "PROCESSING", progress: 5 },
  });

  try {
    // Load all requirements for this tender
    const requirements = await db.requirement.findMany({
      where: { tenderId, deletedAt: null },
      select: {
        id: true,
        textEn: true,
        textAr: true,
        requirementType: true,
        priority: true,
        sectionRef: true,
        tags: true,
      },
    });

    if (requirements.length === 0) {
      await db.aIJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          progress: 100,
          outputMetadata: { message: "No requirements to map" },
        },
      });
      return;
    }

    const tender = await db.tender.findUnique({
      where: { id: tenderId },
      select: { primaryLanguage: true },
    });

    const isArabic = tender?.primaryLanguage === "AR" ||
                     tender?.primaryLanguage === "AR_SA" ||
                     tender?.primaryLanguage === "AR_AE" ||
                     tender?.primaryLanguage === "AR_EG";

    // Process in batches of 15 requirements
    const BATCH_SIZE = 15;
    const batches: typeof requirements[] = [];
    for (let i = 0; i < requirements.length; i += BATCH_SIZE) {
      batches.push(requirements.slice(i, i + BATCH_SIZE));
    }

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let processedCount = 0;

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];

      const reqList = batch
        .map(
          (r) =>
            `ID: ${r.id}
Text: ${r.textEn}${r.textAr ? `\nArabic: ${r.textAr}` : ""}
Type: ${r.requirementType} | Priority: ${r.priority}
Section Hint: ${r.sectionRef ?? "Not specified"}`
        )
        .join("\n\n---\n\n");

      const userMessage = `Map the following ${batch.length} requirements to proposal sections and generate template responses.
${isArabic ? "Also provide Arabic template responses (response_template_ar)." : "Set response_template_ar to null."}

Requirements:
${reqList}

Return JSON: { "mappings": [{ "requirement_id": "...", "section": "SECTION_TYPE", "response_template_en": "...", "response_template_ar": null }] }`;

      try {
        const response = await withRetry(() =>
          generateObject({
            model: getChatModel(MODELS.CLAUDE_HAIKU), // cloud Haiku or local vLLM
            schema: ComplianceMappingSchema,
            schemaName: "compliance_mappings",
            temperature: 0,
            maxOutputTokens: 4000,
            system: COMPLIANCE_SYSTEM_PROMPT,
            prompt: userMessage,
          })
        );

        totalPromptTokens += response.usage.inputTokens ?? 0;
        totalCompletionTokens += response.usage.outputTokens ?? 0;
        const parsed: ComplianceMappingResult = response.object;

        // Update compliance matrix rows in DB
        await Promise.all(
          (parsed.mappings ?? []).map(async (mapping) => {
            const section = mapping.section as SectionType;
            if (!mapping.requirement_id) return;

            await db.complianceMatrixRow.updateMany({
              where: {
                requirementId: mapping.requirement_id,
                tenderId,
              },
              data: {
                sectionReference: section,
                responseEn: mapping.response_template_en || null,
                responseAr: mapping.response_template_ar || null,
              },
            });
          })
        );

        processedCount += batch.length;
      } catch (parseErr) {
        console.warn(
          `[compliance] Failed to parse batch ${batchIdx + 1} response:`,
          parseErr
        );
      }

      // Update progress
      const progress = Math.round(10 + (processedCount / requirements.length) * 85);
      await db.aIJob.update({
        where: { id: jobId },
        data: { progress },
      });
    }

    // ── Finalize ───────────────────────────────────────────────────────────────
    const cost = calculateCost(
      MODELS.CLAUDE_HAIKU,
      totalPromptTokens,
      totalCompletionTokens
    );

    await db.aIJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        progress: 100,
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
        costUsd: cost,
        latencyMs: Date.now() - startTime,
        outputMetadata: { requirementsMapped: processedCount },
      },
    });

    console.log(
      `[compliance] ✅ Job ${jobId}: mapped ${processedCount} requirements, $${cost.toFixed(6)}`
    );
  } catch (err) {
    console.error(`[compliance] ❌ Job ${jobId} failed:`, err);
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
