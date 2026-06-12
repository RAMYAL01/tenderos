import { TYPE_SECTOR_AFFINITY, BAND_VALUE_CEILING } from "@/lib/discovery/match";

/**
 * Bid/No-Bid — deterministic factor engine.
 *
 * PURE math over the org's profile + win/loss history + the tender's facts.
 * No LLM anywhere in this file: every number here is reproducible, auditable,
 * and unit-tested. The LLM layer (ai/agents/bid-qualifier.ts) may only nudge
 * the final score within a hard ±MAX_LLM_ADJUSTMENT band — it can never set it.
 *
 * Weights sum to 1.0; each factor is normalized to 0..1 before weighting.
 */

export const MAX_LLM_ADJUSTMENT = 0.15;

// Recommendation bands over the FINAL score.
export const BID_THRESHOLD = 0.62;
export const NO_BID_THRESHOLD = 0.38;
/** Below this confidence the engine refuses to call it either way. */
export const MIN_CONFIDENCE_FOR_CALL = 0.3;

const WEIGHTS = {
  profileFit: 0.22, // org type ↔ tender sector affinity
  geographyFit: 0.16, // home market vs tender country
  valueFit: 0.16, // contract size vs org capacity band
  historyFit: 0.24, // win rate + loss patterns in this sector/country
  deadlinePressure: 0.12, // time left to prepare
  requirementsRisk: 0.1, // mandatory/critical requirement load
} as const;

export type FactorKey = keyof typeof WEIGHTS;

export interface OrgProfileInput {
  organizationType: string | null;
  countryCode: string | null;
  industry: string | null;
  employeeCount: string | null;
}

export interface HistoryInput {
  /** Tender outcomes in the SAME sector as the analyzed tender. */
  sectorWins: number;
  sectorLosses: number;
  /** Outcomes in the SAME country. */
  countryWins: number;
  countryLosses: number;
  /** All-time totals (signal depth → confidence). */
  totalWins: number;
  totalLosses: number;
  /** Losses in this sector attributed to PRICE (repeated price-outs = caution). */
  sectorPriceLosses: number;
}

export interface TenderFactsInput {
  sector: string | null;
  clientCountry: string | null;
  estimatedValue: number | null;
  submissionDeadline: Date | null;
  mandatoryRequirements: number; // count of MANDATORY/CONDITIONAL extracted
  criticalRequirements: number; // count of CRITICAL priority
}

export interface FactorBreakdown {
  profileFit: number;
  geographyFit: number;
  valueFit: number;
  historyFit: number;
  deadlinePressure: number;
  requirementsRisk: number;
}

export interface DeterministicScore {
  baseScore: number; // 0..1 weighted sum
  confidence: number; // 0..1 how much history backed this
  factors: FactorBreakdown; // each 0..1 (pre-weight, for explainability bars)
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Laplace-smoothed win rate so 1-for-1 doesn't read as 100%. */
function smoothedWinRate(wins: number, losses: number): number {
  return (wins + 1) / (wins + losses + 2);
}

export function computeFactors(
  org: OrgProfileInput,
  history: HistoryInput,
  tender: TenderFactsInput,
  now: Date = new Date()
): DeterministicScore {
  // ── profileFit ── org type ↔ sector affinity (mirrors discovery scoring).
  const prefs = org.organizationType ? TYPE_SECTOR_AFFINITY[org.organizationType] ?? [] : [];
  const sector = (tender.sector ?? "").toLowerCase();
  let profileFit = 0.45; // unknown sector / cross-sector baseline
  if (sector && prefs.includes(sector)) profileFit = 1;
  else if (sector && org.industry && sector === org.industry.toLowerCase()) profileFit = 0.85;
  else if (sector && prefs.length > 0) profileFit = 0.25; // known sector, outside the org's lane

  // ── geographyFit ── home market is a real advantage in gov contracting.
  let geographyFit = 0.5; // unknown
  if (org.countryCode && tender.clientCountry) {
    geographyFit =
      org.countryCode.toUpperCase() === tender.clientCountry.toUpperCase() ? 1 : 0.35;
  }

  // ── valueFit ── contract size vs capacity band (too big = delivery risk,
  // far too small = not worth the bid cost).
  const ceiling = org.employeeCount ? BAND_VALUE_CEILING[org.employeeCount] : undefined;
  let valueFit = 0.55; // unknown value or unknown band
  if (ceiling && tender.estimatedValue != null) {
    const ratio = tender.estimatedValue / ceiling;
    if (ratio <= 0.005) valueFit = 0.5; // tiny relative to capacity — marginal ROI
    else if (ratio <= 1) valueFit = 1; // comfortably inside capacity
    else if (ratio <= 2) valueFit = 0.55; // stretch
    else if (ratio <= 4) valueFit = 0.25; // heavy stretch — JV territory
    else valueFit = 0.05; // out of class
  }

  // ── historyFit ── "more like what we win", with a price-loss penalty.
  const sectorRate = smoothedWinRate(history.sectorWins, history.sectorLosses);
  const countryRate = smoothedWinRate(history.countryWins, history.countryLosses);
  let historyFit = clamp01(0.6 * sectorRate + 0.4 * countryRate);
  // Repeated PRICE losses in this sector → competitive-pricing red flag.
  if (history.sectorPriceLosses >= 2) historyFit = clamp01(historyFit - 0.15);

  // ── deadlinePressure ── days left to prepare (higher = more comfortable).
  let deadlinePressure = 0.6; // no deadline known
  if (tender.submissionDeadline) {
    const days = (tender.submissionDeadline.getTime() - now.getTime()) / 86_400_000;
    if (days <= 0) deadlinePressure = 0; // already closed
    else if (days <= 5) deadlinePressure = 0.1;
    else if (days <= 10) deadlinePressure = 0.35;
    else if (days <= 21) deadlinePressure = 0.7;
    else deadlinePressure = 1;
  }

  // ── requirementsRisk ── heavier mandatory/critical load = more compliance
  // surface to fail on (higher value = LESS risk, to keep all factors "good=1").
  const load = tender.mandatoryRequirements + 2 * tender.criticalRequirements;
  let requirementsRisk: number;
  if (tender.mandatoryRequirements === 0 && tender.criticalRequirements === 0) {
    requirementsRisk = 0.6; // nothing extracted yet — neutral, slightly cautious
  } else if (load <= 15) requirementsRisk = 0.9;
  else if (load <= 40) requirementsRisk = 0.7;
  else if (load <= 80) requirementsRisk = 0.5;
  else requirementsRisk = 0.3;

  const factors: FactorBreakdown = {
    profileFit: +profileFit.toFixed(4),
    geographyFit: +geographyFit.toFixed(4),
    valueFit: +valueFit.toFixed(4),
    historyFit: +historyFit.toFixed(4),
    deadlinePressure: +deadlinePressure.toFixed(4),
    requirementsRisk: +requirementsRisk.toFixed(4),
  };

  const baseScore = clamp01(
    (Object.keys(WEIGHTS) as FactorKey[]).reduce(
      (sum, k) => sum + WEIGHTS[k] * factors[k],
      0
    )
  );

  // ── confidence ── how much signal we actually had: history depth dominates;
  // knowing the profile fields and tender facts adds the rest.
  const decisions = history.totalWins + history.totalLosses;
  const historyDepth = clamp01(decisions / 20); // 20 recorded outcomes = full confidence
  const profileKnown =
    [org.organizationType, org.countryCode, org.employeeCount].filter(Boolean).length / 3;
  const factsKnown =
    [tender.sector, tender.clientCountry, tender.estimatedValue, tender.submissionDeadline].filter(
      (v) => v != null
    ).length / 4;
  const confidence = clamp01(0.5 * historyDepth + 0.25 * profileKnown + 0.25 * factsKnown);

  return { baseScore: +baseScore.toFixed(4), confidence: +confidence.toFixed(4), factors };
}

/** Final score = deterministic base + HARD-clamped LLM nudge. */
export function applyLlmAdjustment(baseScore: number, llmAdjustment: number): number {
  const clamped = Math.max(-MAX_LLM_ADJUSTMENT, Math.min(MAX_LLM_ADJUSTMENT, llmAdjustment || 0));
  return +clamp01(baseScore + clamped).toFixed(4);
}

export function recommend(
  score: number,
  confidence: number
): "BID" | "NO_BID" | "REVIEW" {
  if (confidence < MIN_CONFIDENCE_FOR_CALL) return "REVIEW";
  if (score >= BID_THRESHOLD) return "BID";
  if (score <= NO_BID_THRESHOLD) return "NO_BID";
  return "REVIEW";
}
