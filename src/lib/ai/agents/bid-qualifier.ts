/**
 * Bid/No-Bid Qualification Agent.
 *
 * Division of labor (the TenderOS fence):
 *  - lib/bid-decision/factors.ts computes the DETERMINISTIC score from the
 *    org's profile + win/loss history + tender facts. Pure math, unit-tested.
 *  - This agent adds the QUALITATIVE layer: rationale (EN+AR), concrete risks,
 *    questions to clarify before committing — and may nudge the score by at
 *    most ±0.15 (hard-clamped in applyLlmAdjustment; it can never set it).
 *
 * The persisted BidDecision keeps baseScore and llmAdjustment separately, so
 * every recommendation is auditable: "the math said X, the model argued ±Y."
 */

import { generateObject } from "ai";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { MODELS, calculateCost, withRetry } from "@/lib/ai/client";
import { getChatModel, activeModelId } from "@/lib/ai/llm-provider";
import {
  computeFactors,
  applyLlmAdjustment,
  recommend,
  type HistoryInput,
  type TenderFactsInput,
} from "@/lib/bid-decision/factors";

const QualifierSchema = z.object({
  rationale_en: z.string().describe("4-8 sentence professional bid/no-bid rationale in English"),
  rationale_ar: z.string().nullable().describe("The same rationale in formal Arabic"),
  risks: z
    .array(
      z.object({
        title: z.string(),
        severity: z.enum(["HIGH", "MEDIUM", "LOW"]),
        detail: z.string(),
      })
    )
    .max(6),
  questions_to_ask: z.array(z.string()).max(6),
  score_adjustment: z
    .number()
    .min(-0.15)
    .max(0.15)
    .describe("Your qualitative nudge to the deterministic score, within ±0.15"),
  adjustment_reason: z.string(),
});

const SYSTEM_PROMPT = `You are a senior bid director at a MENA government contractor with 20 years of capture experience. You evaluate whether the company should bid on a tender.

You are given the company's profile, its win/loss history signals, the tender's facts, and a DETERMINISTIC score breakdown computed by the platform. Your job is the qualitative layer only:
- A crisp, professional rationale (English, then the same in formal Arabic) a bid committee could read aloud.
- Concrete risks specific to THIS tender (payment terms, delivery capacity, compliance load, competition, localization requirements) — never generic filler.
- Questions the team should clarify with the client or internally before committing.
- A score adjustment STRICTLY within ±0.15: positive if qualitative context strengthens the case beyond the math, negative if it weakens it. The platform hard-clamps whatever you return; do not try to exceed it.

Be honest and decisive. If the math says no and you agree, say so plainly. Never invent facts not present in the input.`;

/** Typed objects → Prisma Json columns (the established codebase pattern). */
function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

export interface BidQualifierResult {
  decisionId: string;
  score: number;
  recommendation: "BID" | "NO_BID" | "REVIEW";
}

export async function runBidQualifierAgent(
  jobId: string,
  tenderId: string,
  orgId: string,
  createdById: string
): Promise<BidQualifierResult> {
  const startTime = Date.now();

  await db.aIJob.update({
    where: { id: jobId },
    data: { status: "PROCESSING", progress: 10 },
  });

  try {
    // ── Gather inputs (all org-scoped) ───────────────────────────────────────
    const [org, tender] = await Promise.all([
      db.organization.findUnique({
        where: { id: orgId },
        select: {
          name: true,
          organizationType: true,
          countryCode: true,
          industry: true,
          employeeCount: true,
        },
      }),
      db.tender.findFirst({
        where: { id: tenderId, orgId, deletedAt: null },
        select: {
          titleEn: true,
          titleAr: true,
          sector: true,
          clientName: true,
          clientCountry: true,
          tenderType: true,
          estimatedValue: true,
          currency: true,
          submissionDeadline: true,
          notes: true,
        },
      }),
    ]);
    if (!org || !tender) throw new Error("Tender not found");

    const sector = tender.sector ?? null;
    const country = tender.clientCountry ?? null;

    const [outcomes, mandatoryCount, criticalCount, topRequirements] = await Promise.all([
      db.tender.findMany({
        where: { orgId, status: { in: ["WON", "LOST"] }, deletedAt: null },
        select: { status: true, sector: true, clientCountry: true, lossReason: true },
        take: 300,
      }),
      db.requirement.count({
        where: { tenderId, orgId, requirementType: { in: ["MANDATORY", "CONDITIONAL"] }, deletedAt: null },
      }),
      db.requirement.count({
        where: { tenderId, orgId, priority: "CRITICAL", deletedAt: null },
      }),
      db.requirement.findMany({
        where: { tenderId, orgId, requirementType: "MANDATORY", deletedAt: null },
        orderBy: { priority: "asc" },
        take: 20,
        select: { textEn: true, sectionRef: true },
      }),
    ]);

    const history: HistoryInput = {
      sectorWins: outcomes.filter((t) => t.status === "WON" && eq(t.sector, sector)).length,
      sectorLosses: outcomes.filter((t) => t.status === "LOST" && eq(t.sector, sector)).length,
      countryWins: outcomes.filter((t) => t.status === "WON" && eq(t.clientCountry, country)).length,
      countryLosses: outcomes.filter((t) => t.status === "LOST" && eq(t.clientCountry, country)).length,
      totalWins: outcomes.filter((t) => t.status === "WON").length,
      totalLosses: outcomes.filter((t) => t.status === "LOST").length,
      sectorPriceLosses: outcomes.filter(
        (t) => t.status === "LOST" && t.lossReason === "PRICE" && eq(t.sector, sector)
      ).length,
    };

    const facts: TenderFactsInput = {
      sector,
      clientCountry: country,
      estimatedValue: tender.estimatedValue ? Number(tender.estimatedValue.toString()) : null,
      submissionDeadline: tender.submissionDeadline,
      mandatoryRequirements: mandatoryCount,
      criticalRequirements: criticalCount,
    };

    // ── 1. Deterministic score (the number the LLM cannot set) ──────────────
    const det = computeFactors(org, history, facts);

    await db.aIJob.update({ where: { id: jobId }, data: { progress: 40 } });

    // ── 2. Qualitative layer ─────────────────────────────────────────────────
    const userMessage = `COMPANY
Name: ${org.name}
Type: ${org.organizationType ?? "unknown"} · Industry: ${org.industry ?? "unknown"}
Home market: ${org.countryCode ?? "unknown"} · Size band: ${org.employeeCount ?? "unknown"} employees
Track record: ${history.totalWins} wins / ${history.totalLosses} losses overall; in this sector ${history.sectorWins}W/${history.sectorLosses}L; in this country ${history.countryWins}W/${history.countryLosses}L; price-driven losses in sector: ${history.sectorPriceLosses}

TENDER
Title: ${tender.titleEn}${tender.titleAr ? ` / ${tender.titleAr}` : ""}
Client: ${tender.clientName ?? "unknown"} (${country ?? "?"}) · Type: ${tender.tenderType ?? "?"} · Sector: ${sector ?? "?"}
Estimated value: ${facts.estimatedValue != null ? `${facts.estimatedValue.toLocaleString()} ${tender.currency ?? ""}` : "unknown"}
Submission deadline: ${tender.submissionDeadline?.toISOString().slice(0, 10) ?? "unknown"}
Mandatory requirements extracted: ${mandatoryCount} (critical: ${criticalCount})
${tender.notes ? `Notes: ${tender.notes.slice(0, 500)}` : ""}

TOP MANDATORY REQUIREMENTS
${topRequirements.map((r, i) => `[${i + 1}] ${r.sectionRef ? `(${r.sectionRef}) ` : ""}${(r.textEn ?? "").slice(0, 200)}`).join("\n") || "(none extracted yet)"}

DETERMINISTIC SCORE (platform-computed, you may only nudge ±0.15)
Base score: ${det.baseScore} · Confidence: ${det.confidence}
Factors (0..1, higher is better): ${JSON.stringify(det.factors)}

Produce the qualitative assessment.`;

    const response = await withRetry(() =>
      generateObject({
        model: getChatModel(),
        schema: QualifierSchema,
        schemaName: "bid_qualification",
        temperature: 0,
        maxOutputTokens: 3000,
        system: SYSTEM_PROMPT,
        prompt: userMessage,
      })
    );

    await db.aIJob.update({ where: { id: jobId }, data: { progress: 80 } });

    const q = response.object;
    const score = applyLlmAdjustment(det.baseScore, q.score_adjustment);
    const recommendation = recommend(score, det.confidence);
    const llmAdjustment = +(score - det.baseScore).toFixed(4);
    const modelVersion = activeModelId();

    // ── 3. Persist (upsert: re-running replaces the analysis, clears any old
    //       human decision — the situation has been re-assessed) ─────────────
    const decision = await db.bidDecision.upsert({
      where: { tenderId },
      create: {
        orgId,
        tenderId,
        score,
        baseScore: det.baseScore,
        llmAdjustment,
        confidence: det.confidence,
        recommendation,
        factors: toJson(det.factors),
        rationale: q.rationale_en,
        rationaleAr: q.rationale_ar,
        risks: toJson(q.risks),
        questionsToAsk: toJson(q.questions_to_ask),
        modelVersion,
        createdById,
      },
      update: {
        score,
        baseScore: det.baseScore,
        llmAdjustment,
        confidence: det.confidence,
        recommendation,
        factors: toJson(det.factors),
        rationale: q.rationale_en,
        rationaleAr: q.rationale_ar,
        risks: toJson(q.risks),
        questionsToAsk: toJson(q.questions_to_ask),
        modelVersion,
        createdById,
        humanDecision: null,
        decidedById: null,
        decidedAt: null,
        decisionNotes: null,
      },
      select: { id: true },
    });

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
        resultRef: JSON.stringify({ decisionId: decision.id, score, recommendation }),
        outputMetadata: { score, baseScore: det.baseScore, llmAdjustment, recommendation },
      },
    });

    return { decisionId: decision.id, score, recommendation };
  } catch (err) {
    console.error(`[bid-qualifier] job ${jobId} failed:`, err);
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

function eq(a: string | null, b: string | null): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}
