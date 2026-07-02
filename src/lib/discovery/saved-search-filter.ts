/**
 * Server-side enforcement of SavedSearch.filters (Wave 3, #7 — Auto-Pursuit).
 *
 * A saved search stores `{ query?, filter? }` — the same shape the discover-list
 * applies CLIENT-side. Until now the cron ignored it: the daily alert digested
 * EVERY high-relevance profile match, so a saved "policy" never actually shaped
 * what a tenant was alerted about. This module makes the policy act server-side.
 *
 * Pure + framework-free (no db, no next) so it can be unit-tested and shared.
 */

export type DiscoverFilterKey = "all" | "strong" | "closing" | "saved";

export interface SavedSearchFilters {
  query?: string;
  filter?: DiscoverFilterKey;
}

export interface MatchLike {
  relevanceScore: number;
  trackingStatus: string;
  opportunity: {
    titleEn: string;
    titleAr?: string | null;
    buyerName?: string | null;
    sector?: string | null;
    country?: string | null;
    closingDate?: Date | null;
  };
}

const CLOSING_SOON_DAYS = 7;
const STRONG_SCORE = 0.6;

function isClosingSoon(d: Date | null | undefined, now: number): boolean {
  if (!d) return false;
  const days = (new Date(d).getTime() - now) / 86_400_000;
  return days >= 0 && days <= CLOSING_SOON_DAYS;
}

/**
 * Does a match satisfy one saved search's filters? Mirrors the discover-list
 * predicate — except "saved"/"all" are VIEW filters (not surfacing constraints),
 * so they add no constraint when deciding what to proactively alert on.
 */
export function matchSatisfiesSavedSearch(
  m: MatchLike,
  filters: SavedSearchFilters,
  now: number = Date.now()
): boolean {
  const f = filters.filter ?? "all";
  if (f === "strong" && m.relevanceScore < STRONG_SCORE) return false;
  if (f === "closing" && !isClosingSoon(m.opportunity.closingDate, now)) return false;

  const q = (filters.query ?? "").trim().toLowerCase();
  if (q) {
    const o = m.opportunity;
    const hay = `${o.titleEn} ${o.titleAr ?? ""} ${o.buyerName ?? ""} ${o.sector ?? ""} ${o.country ?? ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

/** A policy only constrains surfacing if it has a keyword or a "strong"/"closing" filter. */
function isSurfacingPolicy(p: SavedSearchFilters): boolean {
  return !!(p.query && p.query.trim()) || p.filter === "strong" || p.filter === "closing";
}

/**
 * Does a match satisfy ANY of the org's saved-search policies? If the org has no
 * surfacing policy (only empty / "all" / "saved" searches), we do NOT over-constrain
 * — the profile matcher's relevance already gates the digest, so behavior is
 * unchanged for those tenants.
 */
export function matchSatisfiesAnyPolicy(
  m: MatchLike,
  policies: SavedSearchFilters[],
  now: number = Date.now()
): boolean {
  const surfacing = policies.filter(isSurfacingPolicy);
  if (surfacing.length === 0) return true;
  return surfacing.some((p) => matchSatisfiesSavedSearch(m, p, now));
}
