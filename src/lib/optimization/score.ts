/**
 * Deterministic bid-optimization scoring engine.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NO AI. NO RANDOMNESS. Every score below is a pure arithmetic function of
 * structured inputs already present in the database (requirements, compliance
 * rows, proposal sections, the priced financial breakdown, and the org's own
 * historical win/loss record). Same inputs → same scores, always.
 *
 * The engine answers six questions a bid manager asks before submitting:
 *   1. Compliance      — are the mandatory requirements actually addressed?
 *   2. Completeness    — is the technical proposal substantively written?
 *   3. Missing items   — which requirements still have no response?
 *   4. Pricing risk    — is the margin dangerously thin or uncompetitively fat?
 *   5. Historical edge — how often has this org won comparable bids?
 *   6. Win probability — a transparent blend of the above.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type {
  RequirementType,
  RequirementPriority,
  ComplianceStatus,
} from "@prisma/client";

// ── Inputs ───────────────────────────────────────────────────────────────────

export interface RequirementInput {
  id: string;
  textEn?: string | null;
  textAr?: string | null;
  requirementType: RequirementType;
  priority: RequirementPriority;
  /** Compliance status for this requirement, if a matrix row exists. */
  complianceStatus?: ComplianceStatus | null;
  /** Whether the matrix row carries an actual response (EN or AR). */
  hasResponse?: boolean;
}

export interface SectionInput {
  titleEn?: string | null;
  contentEn?: string | null;
  contentAr?: string | null;
}

export interface FinancialInput {
  /** Net (ex-VAT) bid price. 0 / undefined → not yet priced. */
  netPrice: number;
  /** Effective profit margin %, as entered by the user. */
  profitMarginPct: number;
  /** Direct cost — used to confirm a real cost build-up exists. */
  directCost: number;
  /** Optional client budget / estimated value to compare against. */
  estimatedValue?: number | null;
}

export interface HistoryInput {
  won: number;
  lost: number;
}

export interface OptimizationInput {
  requirements: RequirementInput[];
  sections: SectionInput[];
  financial?: FinancialInput | null;
  history: HistoryInput;
}

// ── Outputs ──────────────────────────────────────────────────────────────────

export type RiskLevel = "low" | "medium" | "high";

export interface ScoreDetail {
  /** 0–100. */
  score: number;
  level: RiskLevel;
  label: string;
  detail: string;
}

export interface MissingRequirement {
  id: string;
  text: string;
  requirementType: RequirementType;
  priority: RequirementPriority;
  reason: "no_response" | "not_started" | "flagged";
}

export interface PricingAssessment {
  /** 0–100 risk score — higher = riskier. */
  riskScore: number;
  level: RiskLevel;
  margin: number;
  notes: string[];
}

export interface OptimizationReport {
  winProbability: ScoreDetail;
  compliance: ScoreDetail;
  completeness: ScoreDetail;
  pricing: PricingAssessment;
  historical: {
    winRate: number; // 0–100
    sampleSize: number;
    label: string;
  };
  missing: MissingRequirement[];
  /** Highest-leverage, deterministic next actions. */
  recommendations: string[];
}

// ── Tunables (transparent weights) ────────────────────────────────────────────

const MANDATORY_WEIGHT = 3;
const OPTIONAL_WEIGHT = 1;

const PRIORITY_WEIGHT: Record<RequirementPriority, number> = {
  CRITICAL: 3,
  HIGH: 2,
  MEDIUM: 1.5,
  LOW: 1,
} as Record<RequirementPriority, number>;

/** Win-probability blend weights (sum = 1). */
const BLEND = {
  compliance: 0.4,
  completeness: 0.25,
  pricing: 0.2,
  historical: 0.15,
};

/** Healthy margin band — outside this, pricing risk rises. */
const MARGIN_FLOOR = 5; // below → margin too thin to absorb risk
const MARGIN_HEALTHY_LOW = 8;
const MARGIN_HEALTHY_HIGH = 18;
const MARGIN_CEILING = 25; // above → likely uncompetitive

// ── Engine ────────────────────────────────────────────────────────────────────

export function buildOptimizationReport(
  input: OptimizationInput
): OptimizationReport {
  const compliance = scoreCompliance(input.requirements);
  const completeness = scoreCompleteness(input.sections);
  const pricing = assessPricing(input.financial ?? null);
  const historical = scoreHistory(input.history);
  const missing = findMissingRequirements(input.requirements);

  // Win probability — transparent weighted blend, each term already 0–100.
  // Pricing contributes as (100 − riskScore) so lower risk lifts probability.
  const pricingContribution = 100 - pricing.riskScore;
  const blended =
    compliance.score * BLEND.compliance +
    completeness.score * BLEND.completeness +
    pricingContribution * BLEND.pricing +
    historical.winRate * BLEND.historical;

  const winScore = clamp(round1(blended));

  const winProbability: ScoreDetail = {
    score: winScore,
    level: bandFromScore(winScore),
    label: winLabel(winScore),
    detail: `Blend of compliance (${pct(BLEND.compliance)}), completeness (${pct(
      BLEND.completeness
    )}), pricing (${pct(BLEND.pricing)}), and historical win rate (${pct(
      BLEND.historical
    )}).`,
  };

  const recommendations = buildRecommendations({
    compliance,
    completeness,
    pricing,
    missing,
    historical,
  });

  return {
    winProbability,
    compliance,
    completeness,
    pricing,
    historical,
    missing,
    recommendations,
  };
}

// ── 1. Compliance ──────────────────────────────────────────────────────────────
// Weighted share of requirements that are satisfied. A requirement counts as
// satisfied when its matrix row is COMPLETED or NOT_APPLICABLE. Mandatory and
// higher-priority requirements carry proportionally more weight.

function reqWeight(r: RequirementInput): number {
  const typeW =
    r.requirementType === "MANDATORY" ? MANDATORY_WEIGHT : OPTIONAL_WEIGHT;
  const prioW = PRIORITY_WEIGHT[r.priority] ?? 1;
  return typeW * prioW;
}

function isSatisfied(status?: ComplianceStatus | null): boolean {
  return status === "COMPLETED" || status === "NOT_APPLICABLE";
}

function scoreCompliance(requirements: RequirementInput[]): ScoreDetail {
  if (requirements.length === 0) {
    return {
      score: 0,
      level: "high",
      label: "No requirements",
      detail:
        "No requirements have been extracted yet — extract them before bidding.",
    };
  }

  let totalWeight = 0;
  let metWeight = 0;
  let partialWeight = 0;

  for (const r of requirements) {
    const w = reqWeight(r);
    totalWeight += w;
    if (isSatisfied(r.complianceStatus)) metWeight += w;
    else if (r.complianceStatus === "IN_PROGRESS") partialWeight += w;
  }

  // In-progress rows earn half credit — work is underway but not done.
  const score = clamp(round1(((metWeight + partialWeight * 0.5) / totalWeight) * 100));

  const mandatoryOpen = requirements.filter(
    (r) => r.requirementType === "MANDATORY" && !isSatisfied(r.complianceStatus)
  ).length;

  return {
    score,
    level: bandFromScore(score),
    label: `${score}% addressed`,
    detail:
      mandatoryOpen > 0
        ? `${mandatoryOpen} mandatory requirement${
            mandatoryOpen === 1 ? "" : "s"
          } still unaddressed — these can disqualify the bid.`
        : "All mandatory requirements are addressed.",
  };
}

// ── 2. Completeness ────────────────────────────────────────────────────────────
// How substantively the technical proposal is written. We measure the share of
// sections that carry real content (≥ a minimum length), not just a heading.

const MIN_SECTION_CHARS = 120;

function scoreCompleteness(sections: SectionInput[]): ScoreDetail {
  if (sections.length === 0) {
    return {
      score: 0,
      level: "high",
      label: "No sections",
      detail: "No proposal sections drafted yet.",
    };
  }

  let written = 0;
  for (const s of sections) {
    const len =
      (s.contentEn?.trim().length ?? 0) + (s.contentAr?.trim().length ?? 0);
    if (len >= MIN_SECTION_CHARS) written += 1;
  }

  const score = clamp(round1((written / sections.length) * 100));
  const empty = sections.length - written;

  return {
    score,
    level: bandFromScore(score),
    label: `${written}/${sections.length} sections written`,
    detail:
      empty > 0
        ? `${empty} section${empty === 1 ? "" : "s"} ${
            empty === 1 ? "is" : "are"
          } empty or too thin to be persuasive.`
        : "Every section carries substantive content.",
  };
}

// ── 3. Missing requirements ────────────────────────────────────────────────────
// Requirements that have no compliance row, are NOT_STARTED, or FLAGGED.
// Mandatory + higher priority float to the top.

function findMissingRequirements(
  requirements: RequirementInput[]
): MissingRequirement[] {
  const missing: MissingRequirement[] = [];

  for (const r of requirements) {
    let reason: MissingRequirement["reason"] | null = null;
    if (r.complianceStatus === "FLAGGED") reason = "flagged";
    else if (!r.complianceStatus || r.complianceStatus === "NOT_STARTED")
      reason = "not_started";
    else if (!isSatisfied(r.complianceStatus) && !r.hasResponse)
      reason = "no_response";

    if (reason) {
      missing.push({
        id: r.id,
        text: (r.textEn || r.textAr || "Untitled requirement").slice(0, 200),
        requirementType: r.requirementType,
        priority: r.priority,
        reason,
      });
    }
  }

  // Sort: mandatory first, then by priority weight, then flagged before not_started.
  return missing.sort((a, b) => {
    const am = a.requirementType === "MANDATORY" ? 1 : 0;
    const bm = b.requirementType === "MANDATORY" ? 1 : 0;
    if (am !== bm) return bm - am;
    const ap = PRIORITY_WEIGHT[a.priority] ?? 1;
    const bp = PRIORITY_WEIGHT[b.priority] ?? 1;
    return bp - ap;
  });
}

// ── 4. Pricing risk ────────────────────────────────────────────────────────────
// Deterministic read on the priced financial proposal. We never suggest a price;
// we only flag when the user-entered margin sits outside a defensible band, or
// when the bid has not been priced at all.

function assessPricing(financial: FinancialInput | null): PricingAssessment {
  if (!financial || financial.directCost <= 0 || financial.netPrice <= 0) {
    return {
      riskScore: 100,
      level: "high",
      margin: 0,
      notes: ["No priced financial proposal yet — build the cost model first."],
    };
  }

  const margin = round1(financial.profitMarginPct);
  const notes: string[] = [];
  let risk = 0;

  if (margin < MARGIN_FLOOR) {
    risk = 85;
    notes.push(
      `Margin of ${margin}% is below the ${MARGIN_FLOOR}% floor — almost no buffer for cost overruns or penalties.`
    );
  } else if (margin < MARGIN_HEALTHY_LOW) {
    risk = 55;
    notes.push(
      `Margin of ${margin}% is thin. Competitive, but leaves little room for risk.`
    );
  } else if (margin <= MARGIN_HEALTHY_HIGH) {
    risk = 20;
    notes.push(
      `Margin of ${margin}% sits in a healthy, defensible band (${MARGIN_HEALTHY_LOW}–${MARGIN_HEALTHY_HIGH}%).`
    );
  } else if (margin <= MARGIN_CEILING) {
    risk = 50;
    notes.push(
      `Margin of ${margin}% is on the high side — may be undercut on price.`
    );
  } else {
    risk = 75;
    notes.push(
      `Margin of ${margin}% is above ${MARGIN_CEILING}% — high risk of being uncompetitive on price.`
    );
  }

  // If a client budget/estimate is known, compare against the net price.
  if (financial.estimatedValue && financial.estimatedValue > 0) {
    const ratio = financial.netPrice / financial.estimatedValue;
    const over = round1((ratio - 1) * 100);
    if (ratio > 1.1) {
      risk = Math.min(100, risk + 20);
      notes.push(
        `Net price is ${over}% above the client's estimated value — likely over budget.`
      );
    } else if (ratio < 0.7) {
      risk = Math.min(100, risk + 15);
      notes.push(
        `Net price is ${Math.abs(over)}% below the estimate — verify nothing is under-scoped.`
      );
    } else {
      notes.push("Net price is within range of the client's estimated value.");
    }
  }

  return {
    riskScore: clamp(round1(risk)),
    level: risk >= 70 ? "high" : risk >= 40 ? "medium" : "low",
    margin,
    notes,
  };
}

// ── 5. Historical win rate ─────────────────────────────────────────────────────

function scoreHistory(history: HistoryInput): OptimizationReport["historical"] {
  const decided = history.won + history.lost;
  if (decided === 0) {
    return {
      winRate: 50, // neutral prior when there's no track record
      sampleSize: 0,
      label: "No decided bids yet — using a neutral baseline.",
    };
  }
  const winRate = clamp(round1((history.won / decided) * 100));
  return {
    winRate,
    sampleSize: decided,
    label: `${history.won} won of ${decided} decided bid${
      decided === 1 ? "" : "s"
    } (${winRate}%).`,
  };
}

// ── 6. Recommendations ─────────────────────────────────────────────────────────

function buildRecommendations(args: {
  compliance: ScoreDetail;
  completeness: ScoreDetail;
  pricing: PricingAssessment;
  missing: MissingRequirement[];
  historical: OptimizationReport["historical"];
}): string[] {
  const recs: string[] = [];

  const mandatoryMissing = args.missing.filter(
    (m) => m.requirementType === "MANDATORY"
  );
  if (mandatoryMissing.length > 0) {
    recs.push(
      `Address ${mandatoryMissing.length} unmet mandatory requirement${
        mandatoryMissing.length === 1 ? "" : "s"
      } before submitting — these are the most common disqualifiers.`
    );
  }

  if (args.compliance.score < 80) {
    recs.push(
      "Raise the compliance matrix to at least 80% addressed; reviewers score heavily on coverage."
    );
  }

  if (args.completeness.score < 70) {
    recs.push(
      "Flesh out thin or empty proposal sections — short sections read as low effort."
    );
  }

  if (args.pricing.level === "high") {
    recs.push(
      `Review pricing: ${args.pricing.notes[0] ?? "the margin sits outside a defensible band."}`
    );
  }

  if (args.historical.sampleSize >= 3 && args.historical.winRate < 40) {
    recs.push(
      "Win rate on comparable bids is low — consider a debrief on recent losses to find the recurring gap."
    );
  }

  if (recs.length === 0) {
    recs.push(
      "This bid is in strong shape across compliance, completeness, and pricing. Do a final proofing pass and submit."
    );
  }

  return recs;
}

// ── helpers ────────────────────────────────────────────────────────────────────

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}
function round1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}
function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
function bandFromScore(score: number): RiskLevel {
  if (score >= 70) return "low";
  if (score >= 45) return "medium";
  return "high";
}
function winLabel(score: number): string {
  if (score >= 75) return "Strong";
  if (score >= 55) return "Competitive";
  if (score >= 40) return "Uncertain";
  return "Long shot";
}
