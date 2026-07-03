/**
 * Per-Bid Commercial Model Agent.
 *
 * Generates a bid-specific commercial/business model — how to DELIVER, how to
 * PRICE, how to PARTNER, the commercial TERMS to manage, the RISKS, and the WIN
 * THEMES — grounded in three real inputs: the tender facts, the org's Knowledge
 * Brain (RAG over its own uploaded capabilities/past-performance/rates), and the
 * cross-customer award benchmark (median winning bid, win rate, top competitors).
 *
 * This is the commercial counterpart to the Bid/No-Bid qualifier: the qualifier
 * decides WHETHER to bid; this decides HOW to win commercially.
 */

import { generateObject } from "ai";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { MODELS, calculateCost, withRetry } from "@/lib/ai/client";
import { getChatModel, activeModelId } from "@/lib/ai/llm-provider";
import { getContentLibraryContext } from "@/lib/ai/embeddings";
import { getAwardBenchmark, deriveConcentration } from "@/lib/benchmark/read";
import { toValueBand, VALUE_BAND_LABELS } from "@/lib/benchmark/bands";

const CommercialModelSchema = z.object({
  summary: z.string().describe("One tight paragraph framing the commercial strategy for THIS bid"),
  delivery_approach: z.string().describe("How the company delivers the scope: self-perform vs subcontract split, phasing, key methods, resourcing, schedule posture"),
  pricing_strategy: z.string().describe("Pricing positioning (aggressive / competitive / premium), target-margin logic, alignment to the market benchmark, and the main cost drivers to control"),
  partnering: z.string().describe("JV / consortium / subcontracting needs, which scope to partner out and why, and any local-content / partner requirements"),
  commercial_terms: z.array(z.object({ item: z.string(), position: z.string() })).max(8).describe("Key commercial terms to manage (payment terms, advance, retention, bid/performance bonds, LDs, variations) with the recommended position"),
  risks: z.array(z.object({ title: z.string(), severity: z.enum(["HIGH", "MEDIUM", "LOW"]), mitigation: z.string() })).max(6),
  win_themes: z.array(z.string()).max(5).describe("The commercial differentiators / win themes to lead the bid with"),
});

const SYSTEM_PROMPT = `You are a senior commercial director at a MENA government/infrastructure contractor with 20 years of capture and delivery experience. Produce a bid-specific COMMERCIAL MODEL for the tender described.

Ground EVERYTHING in the three inputs you are given: (1) the tender's facts, (2) the company's own capabilities and track record (from its Knowledge Brain), and (3) the market award benchmark. Be concrete and specific to THIS bid — never generic filler. If the company clearly lacks a capability the scope needs, say so and recommend partnering. If the benchmark shows an entrenched incumbent or a tight median, let that shape the pricing and win themes. Formal, decisive, board-ready — a commercial committee should be able to act on it.`;

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

export interface CommercialModelResult {
  id: string;
}

export async function runCommercialModelAgent(
  jobId: string,
  tenderId: string,
  orgId: string,
  createdById: string
): Promise<CommercialModelResult> {
  const startTime = Date.now();
  await db.aIJob.update({ where: { id: jobId }, data: { status: "PROCESSING", progress: 10 } });

  try {
    const [org, tender] = await Promise.all([
      db.organization.findUnique({
        where: { id: orgId },
        select: { name: true, organizationType: true, countryCode: true, industry: true, employeeCount: true },
      }),
      db.tender.findFirst({
        where: { id: tenderId, orgId, deletedAt: null },
        select: {
          titleEn: true, titleAr: true, sector: true, clientName: true, clientCountry: true,
          tenderType: true, estimatedValue: true, currency: true, submissionDeadline: true, notes: true,
        },
      }),
    ]);
    if (!org || !tender) throw new Error("Tender not found");

    const sector = tender.sector ?? null;
    const country = tender.clientCountry ?? null;
    const valueBand = tender.estimatedValue
      ? toValueBand(BigInt(Math.round(Number(tender.estimatedValue.toString()) * 100)))
      : null;

    // Knowledge Brain (RAG over the org's own uploaded docs) + award benchmark, in parallel.
    const kbQuery = `${tender.titleEn} ${sector ?? ""} ${tender.tenderType ?? ""} capabilities past performance rates certifications`;
    const [knowledge, mandatoryCount, benchmark] = await Promise.all([
      getContentLibraryContext(orgId, kbQuery, undefined, 6),
      db.requirement.count({ where: { tenderId, orgId, requirementType: { in: ["MANDATORY", "CONDITIONAL"] }, deletedAt: null } }),
      getAwardBenchmark({ sector, country, valueBand: valueBand && valueBand !== "UNKNOWN" ? valueBand : null }),
    ]);

    await db.aIJob.update({ where: { id: jobId }, data: { progress: 40 } });

    const marketBlock = benchmark.suppressed
      ? "No sufficient award-benchmark data for this cell yet."
      : `Cohort ${benchmark.cohortSize} pooled awards. Median winning bid: ${
          benchmark.median != null ? `${benchmark.currency ?? tender.currency ?? ""} ${Math.round(benchmark.median).toLocaleString()}` : "n/a"
        }. Pool win rate: ${benchmark.winRate != null ? Math.round(benchmark.winRate * 100) + "%" : "n/a"}. Avg bidders: ${benchmark.avgBidders ?? "n/a"}. Top winners: ${
          benchmark.topWinners.slice(0, 4).map((w) => `${w.name} (${w.count})`).join(", ") || "—"
        }. Top-3 concentration: ${Math.round(deriveConcentration(benchmark).top3Share * 100)}%.`;

    const userMessage = `COMPANY
Name: ${org.name} · Type: ${org.organizationType ?? "unknown"} · Industry: ${org.industry ?? "unknown"} · Home market: ${org.countryCode ?? "?"} · Size: ${org.employeeCount ?? "?"} employees

TENDER
Title: ${tender.titleEn}${tender.titleAr ? ` / ${tender.titleAr}` : ""}
Client: ${tender.clientName ?? "unknown"} (${country ?? "?"}) · Type: ${tender.tenderType ?? "?"} · Sector: ${sector ?? "?"}
Estimated value: ${tender.estimatedValue ? `${Number(tender.estimatedValue.toString()).toLocaleString()} ${tender.currency ?? ""}` : "unknown"} ${valueBand && valueBand !== "UNKNOWN" ? `(${VALUE_BAND_LABELS[valueBand]})` : ""}
Submission deadline: ${tender.submissionDeadline?.toISOString().slice(0, 10) ?? "unknown"}
Mandatory requirements extracted: ${mandatoryCount}
${tender.notes ? `Notes: ${tender.notes.slice(0, 500)}` : ""}

MARKET BENCHMARK
${marketBlock}

COMPANY KNOWLEDGE BRAIN (retrieved capabilities / track record / rates)
${knowledge.length ? knowledge.map((k, i) => `[${i + 1}] ${k.slice(0, 700)}`).join("\n\n") : "(No knowledge-brain content found — advise the team to upload company profile, past performance, and rate cards for a sharper model.)"}

Produce the commercial model.`;

    const response = await withRetry(() =>
      generateObject({
        model: getChatModel(),
        schema: CommercialModelSchema,
        schemaName: "commercial_model",
        temperature: 0.2,
        maxOutputTokens: 3500,
        system: SYSTEM_PROMPT,
        prompt: userMessage,
      })
    );

    await db.aIJob.update({ where: { id: jobId }, data: { progress: 80 } });

    const m = response.object;
    const modelVersion = activeModelId();
    const record = await db.commercialModel.upsert({
      where: { tenderId },
      create: {
        orgId,
        tenderId,
        summary: m.summary,
        content: toJson({
          deliveryApproach: m.delivery_approach,
          pricingStrategy: m.pricing_strategy,
          partnering: m.partnering,
          commercialTerms: m.commercial_terms,
          risks: m.risks,
          winThemes: m.win_themes,
        }),
        modelVersion,
        createdById,
      },
      update: {
        summary: m.summary,
        content: toJson({
          deliveryApproach: m.delivery_approach,
          pricingStrategy: m.pricing_strategy,
          partnering: m.partnering,
          commercialTerms: m.commercial_terms,
          risks: m.risks,
          winThemes: m.win_themes,
        }),
        modelVersion,
        createdById,
      },
      select: { id: true },
    });

    const inTok = response.usage.inputTokens ?? 0;
    const outTok = response.usage.outputTokens ?? 0;
    await db.aIJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        progress: 100,
        promptTokens: inTok,
        completionTokens: outTok,
        totalTokens: inTok + outTok,
        costUsd: calculateCost(MODELS.CLAUDE_SONNET, inTok, outTok),
        latencyMs: Date.now() - startTime,
        resultRef: JSON.stringify({ commercialModelId: record.id }),
      },
    });

    return { id: record.id };
  } catch (err) {
    console.error(`[commercial-model] job ${jobId} failed:`, err);
    await db.aIJob.update({
      where: { id: jobId },
      data: { status: "FAILED", errorMessage: err instanceof Error ? err.message : String(err), latencyMs: Date.now() - startTime },
    });
    throw err;
  }
}
