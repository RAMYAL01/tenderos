import type { PlanTier, ValueBand } from "@prisma/client";
import { db } from "@/lib/prisma";
import { buildMarketCurve, type PriceToWinMarket } from "@/lib/price-to-win/engine";

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

// ── Price-to-Win: winning-price distribution for a cell ────────────────────────

export interface WinningPriceDistribution {
  market: PriceToWinMarket | null; // null when suppressed or no valued awards
  suppressed: boolean; // below the k-anonymity cohort floor
  cohortSize: number; // valued awards in the dominant currency
}

/**
 * Winning-price distribution for a {sector · country · value-band} cell — the input
 * to the Price-to-Win engine. Only ONE (dominant) currency is used so the curve is
 * comparable. k-anonymized (suppressed below MIN_COHORT) and provenance-free: only
 * bare award values leave the DB, and only the aggregate curve leaves the server.
 * PURE READ.
 */
export async function getWinningPriceDistribution(filter: {
  sector?: string | null;
  country?: string | null;
  valueBand?: ValueBand | null;
}): Promise<WinningPriceDistribution> {
  const rows = await db.awardOutcome.findMany({
    where: {
      ...(filter.sector ? { sector: filter.sector } : {}),
      ...(filter.country ? { country: filter.country } : {}),
      ...(filter.valueBand ? { valueBand: filter.valueBand } : {}),
      awardedValueMinor: { not: null },
    },
    select: { awardedValueMinor: true, currency: true },
    take: 5000,
  });

  // Group by currency — a distribution is only comparable within one currency.
  const byCurrency = new Map<string, number[]>();
  for (const r of rows) {
    if (r.awardedValueMinor == null) continue;
    const cur = r.currency ?? "?";
    const list = byCurrency.get(cur) ?? [];
    list.push(Number(r.awardedValueMinor) / 100);
    byCurrency.set(cur, list);
  }
  const dominant = [...byCurrency.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  const values = dominant?.[1] ?? [];
  const currency = dominant && dominant[0] !== "?" ? dominant[0] : null;

  if (values.length < MIN_COHORT) {
    return { market: null, suppressed: true, cohortSize: values.length };
  }
  const market = buildMarketCurve(values);
  market.currency = currency;
  return { market, suppressed: false, cohortSize: values.length };
}

// ── Market-wide overview (the "market dashboard" read) ─────────────────────────

export const OVERVIEW_MIN = 5; // don't render market stats below this many pooled awards

export interface BenchmarkOverview {
  totalAwards: number;
  fromGazette: number;
  fromNetwork: number;
  bySector: { sector: string; count: number }[];
  byCountry: { country: string; count: number }[];
  topWinners: { name: string; count: number }[];
}

/**
 * Market-wide aggregates over the whole AwardOutcome pool for the standalone
 * dashboard. k-anonymized: only firms with a real track record (≥3 awards) are
 * named, and no individual award is ever surfaced. PURE READ.
 */
export async function getBenchmarkOverview(): Promise<BenchmarkOverview> {
  const [totalAwards, fromGazette, sectorGroups, countryGroups, winnerRows] = await Promise.all([
    db.awardOutcome.count(),
    db.awardOutcome.count({ where: { sourceType: "GAZETTE" } }),
    db.awardOutcome.groupBy({ by: ["sector"], _count: { _all: true } }),
    db.awardOutcome.groupBy({ by: ["country"], _count: { _all: true } }),
    db.awardOutcome.findMany({
      where: { OR: [{ competitorId: { not: null } }, { winnerNameRaw: { not: null } }] },
      select: { winnerNameRaw: true, competitor: { select: { canonicalName: true } } },
      take: 5000,
    }),
  ]);

  const bySector = sectorGroups
    .filter((g) => g.sector)
    .map((g) => ({ sector: g.sector as string, count: g._count._all }))
    .sort((a, b) => b.count - a.count);
  const byCountry = countryGroups
    .filter((g) => g.country)
    .map((g) => ({ country: g.country as string, count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  const winnerCounts = new Map<string, number>();
  for (const r of winnerRows) {
    const name = r.competitor?.canonicalName ?? r.winnerNameRaw;
    if (name) winnerCounts.set(name, (winnerCounts.get(name) ?? 0) + 1);
  }
  const topWinners = [...winnerCounts.entries()]
    .filter(([, c]) => c >= 3) // k-anon: a firm with a track record, never a single award
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  return { totalAwards, fromGazette, fromNetwork: totalAwards - fromGazette, bySector, byCountry, topWinners };
}
