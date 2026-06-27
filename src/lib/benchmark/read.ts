import type { PlanTier, ValueBand } from "@prisma/client";
import { db } from "@/lib/prisma";

/**
 * Benchmark reads (Wave 1, item 1) — k-anonymized aggregates over the global
 * AwardOutcome pool. Cells below MIN_COHORT are SUPPRESSED so no single
 * contributor is re-identifiable, and provenance (sourceTenderId / org) is never
 * selected. PURE READS. Access is plan-gated — contribution is the price of the
 * read tier.
 */

const MIN_COHORT = 5; // k-anonymity threshold

/** Read access is a paid feature — Starter contributes but cannot read. */
export function canReadBenchmarks(planTier: PlanTier): boolean {
  return planTier !== "STARTER";
}

export interface AwardBenchmark {
  cohortSize: number;
  suppressed: boolean; // true → below k-anonymity threshold, stats withheld
  winRate: number | null; // contributor WON share (0..1) among WON/LOST rows
  median: number | null; // awarded value, major units
  p25: number | null;
  p75: number | null;
  currency: string | null; // dominant currency in the cohort
  avgBidders: number | null;
  topWinners: { name: string; count: number }[];
  lossReasons: { reason: string; count: number }[];
}

function suppressed(cohortSize: number): AwardBenchmark {
  return { cohortSize, suppressed: true, winRate: null, median: null, p25: null, p75: null, currency: null, avgBidders: null, topWinners: [], lossReasons: [] };
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export async function getAwardBenchmark(filter: {
  sector?: string | null;
  country?: string | null;
  valueBand?: ValueBand | null;
}): Promise<AwardBenchmark> {
  const rows = await db.awardOutcome.findMany({
    where: {
      ...(filter.sector ? { sector: filter.sector } : {}),
      ...(filter.country ? { country: filter.country } : {}),
      ...(filter.valueBand ? { valueBand: filter.valueBand } : {}),
    },
    select: {
      outcomeType: true,
      awardedValueMinor: true,
      currency: true,
      bidderCount: true,
      lossReason: true,
      winnerNameRaw: true,
      competitor: { select: { canonicalName: true } },
    },
    take: 5000,
  });

  const cohortSize = rows.length;
  if (cohortSize < MIN_COHORT) return suppressed(cohortSize);

  // Win rate (contributor perspective: WON vs LOST; gazette AWARDED rows excluded).
  const perspective = rows.filter((r) => r.outcomeType === "WON" || r.outcomeType === "LOST");
  const winRate = perspective.length
    ? perspective.filter((r) => r.outcomeType === "WON").length / perspective.length
    : null;

  // Awarded-value distribution (major units).
  const valued = rows.filter((r) => r.awardedValueMinor != null);
  const values = valued.map((r) => Number(r.awardedValueMinor) / 100).sort((a, b) => a - b);
  const currencyCounts = new Map<string, number>();
  for (const r of valued) if (r.currency) currencyCounts.set(r.currency, (currencyCounts.get(r.currency) ?? 0) + 1);
  const currency = [...currencyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const bidders = rows.map((r) => r.bidderCount).filter((n): n is number => n != null && n > 0);
  const avgBidders = bidders.length
    ? Math.round((bidders.reduce((a, b) => a + b, 0) / bidders.length) * 10) / 10
    : null;

  // Top winning competitors (canonical name preferred, raw fallback).
  const winnerCounts = new Map<string, number>();
  for (const r of rows) {
    const name = r.competitor?.canonicalName ?? r.winnerNameRaw;
    if (name) winnerCounts.set(name, (winnerCounts.get(name) ?? 0) + 1);
  }
  const topWinners = [...winnerCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));

  const lossCounts = new Map<string, number>();
  for (const r of rows) if (r.lossReason) lossCounts.set(r.lossReason, (lossCounts.get(r.lossReason) ?? 0) + 1);
  const lossReasons = [...lossCounts.entries()].sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ reason, count }));

  return {
    cohortSize,
    suppressed: false,
    winRate,
    median: values.length ? quantile(values, 0.5) : null,
    p25: values.length ? quantile(values, 0.25) : null,
    p75: values.length ? quantile(values, 0.75) : null,
    currency,
    avgBidders,
    topWinners,
    lossReasons,
  };
}
