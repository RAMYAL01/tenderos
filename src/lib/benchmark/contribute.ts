import { db } from "@/lib/prisma";
import type { LossReason } from "@prisma/client";
import { resolveCompetitor, resolveBuyer } from "./entities";
import { toValueBand } from "./bands";

/**
 * Benchmark contribution (Wave 1, item 1) — the data-moat producer.
 *
 * Lifts a tenant's recorded WON/LOST outcome into the GLOBAL, orgId-free
 * AwardOutcome pool: anonymized, entity-resolved, idempotent per contributing
 * tender. Called best-effort (never blocks the debrief) and only when the org
 * hasn't opted out. SANCTIONED GLOBAL WRITER (isolation guard).
 */

export interface AwardContribution {
  sourceTenderId: string;
  outcome: "WON" | "LOST";
  sector?: string | null;
  country?: string | null; // ISO-2
  buyerName?: string | null;
  awardedValue?: number | null; // major units (Tender.awardedValue Decimal)
  currency?: string | null;
  winningCompetitor?: string | null;
  lossReason?: LossReason | null;
  bidderCount?: number | null;
  sourceOpportunityId?: string | null;
}

export async function contributeAwardOutcome(c: AwardContribution): Promise<void> {
  try {
    const awardedValueMinor =
      c.awardedValue != null && Number.isFinite(c.awardedValue)
        ? BigInt(Math.round(c.awardedValue * 100))
        : null;

    const buyerId = c.buyerName ? await resolveBuyer(c.buyerName, c.country, c.sector) : null;
    const competitorId =
      c.outcome === "LOST" && c.winningCompetitor
        ? await resolveCompetitor(c.winningCompetitor, c.country)
        : null;

    const data = {
      outcomeType: c.outcome,
      sector: c.sector ?? null,
      country: c.country ?? null,
      buyerId,
      buyerNameRaw: c.buyerName ?? null,
      competitorId,
      winnerNameRaw: c.outcome === "LOST" ? c.winningCompetitor ?? null : null,
      awardedValueMinor,
      currency: c.currency ?? null,
      valueBand: toValueBand(awardedValueMinor),
      bidderCount: c.bidderCount ?? null,
      lossReason: c.outcome === "LOST" ? c.lossReason ?? null : null,
      sourceOpportunityId: c.sourceOpportunityId ?? null,
    };

    await db.awardOutcome.upsert({
      where: { sourceTenderId: c.sourceTenderId },
      create: { ...data, sourceType: "CUSTOMER_DEBRIEF", sourceTenderId: c.sourceTenderId, awardedAt: new Date() },
      update: data,
    });
  } catch (err) {
    console.error("contributeAwardOutcome (non-blocking) failed:", err);
  }
}

/** Opt-out retraction: remove a set of tenders' contributions from the pool. */
export async function retractContributions(tenderIds: string[]): Promise<void> {
  if (!tenderIds.length) return;
  await db.awardOutcome.deleteMany({ where: { sourceTenderId: { in: tenderIds } } }).catch(() => {});
}
