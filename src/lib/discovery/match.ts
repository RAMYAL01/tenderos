import type { Organization } from "@prisma/client";
import { db } from "@/lib/prisma";

/**
 * Deterministic relevance matcher (Sprint 1).
 *
 * Scores each open Opportunity against an org's profile + won-tender history,
 * producing a transparent 0..1 relevanceScore + a scoreBreakdown for
 * explainability. Semantic/embedding matching is the P2 sprint.
 *
 * ISOLATION: reads the GLOBAL Opportunity catalog read-only; writes ONLY the
 * per-tenant OpportunityMatch join (scoped by orgId). Never writes the catalog.
 *
 * BOUNDED: scores at most MAX_SCAN open opportunities per run, so this can never
 * become an O(catalog) storm. Called from a user/onboarding-triggered action —
 * NEVER from a page render.
 *
 * IDEMPOTENT: upsert on @@unique([orgId, opportunityId]); for an existing match
 * it refreshes ONLY relevanceScore/scoreBreakdown and never downgrades the
 * user's trackingStatus (SAVED/CONVERTED/DISMISSED are preserved).
 */

const MAX_SCAN = 500;
const MIN_SCORE_TO_PERSIST = 0.12;

// organizationType → sectors this org is most likely to bid on.
const TYPE_SECTOR_AFFINITY: Record<string, string[]> = {
  GENERAL_CONTRACTOR: ["construction", "infrastructure", "facilities"],
  EPC_CONTRACTOR: ["oil_gas", "infrastructure", "construction", "energy", "water"],
  CONSTRUCTION_COMPANY: ["construction", "infrastructure"],
  ENGINEERING_CONSULTANT: ["construction", "infrastructure", "consulting", "oil_gas"],
  FACILITIES_MANAGEMENT: ["facilities", "construction"],
  GOVERNMENT_AGENCY: [],
  SUPPLIER_VENDOR: ["construction", "oil_gas", "facilities", "infrastructure"],
  OTHER: [],
};

// employeeCount band → comfortable contract-value ceiling (USD, rough capacity proxy).
const BAND_VALUE_CEILING: Record<string, number> = {
  "1-10": 2_000_000,
  "11-50": 20_000_000,
  "51-200": 100_000_000,
  "201-500": 500_000_000,
  "500+": 5_000_000_000,
};

interface OppForScore {
  id: string;
  country: string | null;
  sector: string | null;
  estimatedValue: { toString(): string } | null;
  publishedAt: Date | null;
  status: string;
}

interface WonSignals {
  sectors: Set<string>;
  countries: Set<string>;
}

function scoreOne(
  org: Pick<Organization, "countryCode" | "organizationType" | "industry" | "employeeCount">,
  opp: OppForScore,
  won: WonSignals
): { score: number; breakdown: Record<string, number> } {
  const b: Record<string, number> = {};

  // Country fit (0.35)
  b.country =
    org.countryCode && opp.country && org.countryCode.toUpperCase() === opp.country.toUpperCase()
      ? 0.35
      : 0;

  // Sector affinity (0.30) — organizationType preference + free-text industry match.
  const prefs = org.organizationType ? TYPE_SECTOR_AFFINITY[org.organizationType] ?? [] : [];
  const sector = (opp.sector ?? "").toLowerCase();
  let affinity = 0.3; // baseline: cross-sector is still possible
  if (sector && prefs.includes(sector)) affinity = 1;
  else if (sector && org.industry && sector === org.industry.toLowerCase()) affinity = 0.8;
  b.sector = +(affinity * 0.3).toFixed(4);

  // Status freshness (0.10)
  b.status = opp.status === "OPEN" ? 0.1 : opp.status === "CLOSING_SOON" ? 0.07 : 0;

  // Value-band fit (0.10) — within the org's capacity ceiling scores full.
  const ceiling = org.employeeCount ? BAND_VALUE_CEILING[org.employeeCount] : undefined;
  const value = opp.estimatedValue ? Number(opp.estimatedValue.toString()) : null;
  if (!ceiling || value == null) b.value = 0.05; // unknown → neutral-ish
  else b.value = value <= ceiling ? 0.1 : value <= ceiling * 3 ? 0.05 : 0;

  // Recency (0.05)
  if (opp.publishedAt) {
    const days = (Date.now() - opp.publishedAt.getTime()) / 86_400_000;
    b.recency = days <= 14 ? 0.05 : days <= 45 ? 0.03 : 0.01;
  } else b.recency = 0.02;

  // "More like what we win" (0.10) — won-tender sector/country overlap.
  let history = 0;
  if (sector && won.sectors.has(sector)) history += 0.06;
  if (opp.country && won.countries.has(opp.country.toUpperCase())) history += 0.04;
  b.history = history;

  const score = Math.max(0, Math.min(1, Object.values(b).reduce((s, n) => s + n, 0)));
  return { score: +score.toFixed(4), breakdown: b };
}

export interface MatchResult {
  scanned: number;
  matched: number;
}

type OrgSignals = {
  org: Pick<Organization, "countryCode" | "organizationType" | "industry" | "employeeCount">;
  won: WonSignals;
};

/** Load the org profile + won-tender signals used by the scorer. */
async function loadOrgSignals(orgId: string): Promise<OrgSignals | null> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { countryCode: true, organizationType: true, industry: true, employeeCount: true },
  });
  if (!org) return null;

  const wonTenders = await db.tender.findMany({
    where: { orgId, status: "WON", deletedAt: null },
    select: { sector: true, clientCountry: true },
    take: 200,
  });
  return {
    org,
    won: {
      sectors: new Set(wonTenders.map((t) => (t.sector ?? "").toLowerCase()).filter(Boolean)),
      countries: new Set(wonTenders.map((t) => (t.clientCountry ?? "").toUpperCase()).filter(Boolean)),
    },
  };
}

/** Score a set of opportunities for one org and persist the per-tenant matches. */
async function scoreAndPersist(orgId: string, signals: OrgSignals, opps: OppForScore[]): Promise<number> {
  let matched = 0;
  for (const opp of opps) {
    const { score, breakdown } = scoreOne(signals.org, opp, signals.won);
    if (score < MIN_SCORE_TO_PERSIST) continue;

    // Idempotent: create as NEW; on update refresh score ONLY (never touch the
    // user's trackingStatus / convertedTenderId / dismissedReason).
    await db.opportunityMatch.upsert({
      where: { orgId_opportunityId: { orgId, opportunityId: opp.id } },
      create: { orgId, opportunityId: opp.id, relevanceScore: score, scoreBreakdown: breakdown, trackingStatus: "NEW" },
      update: { relevanceScore: score, scoreBreakdown: breakdown },
    });
    matched++;
  }
  return matched;
}

/**
 * Compute (and persist) the org's opportunity matches over the full (bounded)
 * open catalog. User/onboarding-triggered. Safe to call repeatedly.
 */
export async function matchOpportunitiesForOrg(orgId: string): Promise<MatchResult> {
  const signals = await loadOrgSignals(orgId);
  if (!signals) return { scanned: 0, matched: 0 };

  // Bounded scan of the GLOBAL catalog (read-only), freshest-closing first.
  const opps = await db.opportunity.findMany({
    where: { status: { in: ["OPEN", "CLOSING_SOON"] } },
    select: { id: true, country: true, sector: true, estimatedValue: true, publishedAt: true, status: true },
    orderBy: [{ closingDate: "asc" }],
    take: MAX_SCAN,
  });

  const matched = await scoreAndPersist(orgId, signals, opps);
  return { scanned: opps.length, matched };
}

/**
 * Delta variant for the daily cron (audit M7): scores ONLY the given changed
 * opportunities for one org — O(delta), never O(catalog) per org.
 */
export async function matchOpportunityDeltaForOrg(
  orgId: string,
  opportunityIds: string[]
): Promise<MatchResult> {
  if (opportunityIds.length === 0) return { scanned: 0, matched: 0 };
  const signals = await loadOrgSignals(orgId);
  if (!signals) return { scanned: 0, matched: 0 };

  const opps = await db.opportunity.findMany({
    where: { id: { in: opportunityIds }, status: { in: ["OPEN", "CLOSING_SOON"] } },
    select: { id: true, country: true, sector: true, estimatedValue: true, publishedAt: true, status: true },
  });

  const matched = await scoreAndPersist(orgId, signals, opps);
  return { scanned: opps.length, matched };
}
