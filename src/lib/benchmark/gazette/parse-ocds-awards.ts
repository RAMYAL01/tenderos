import type { GazetteAdapterSource, NormalizedAward } from "./types";

/**
 * OCDS award-release parser (Wave 1, item 4). The Open Contracting Data Standard
 * is how a growing number of procurement systems publish machine-readable AWARD
 * results — release.awards[] carries the winning supplier(s), value, and date.
 * This is the supply side that feeds the benchmark pool with real award data,
 * independent of customer debriefs. Pure + network-free (unit-tested).
 *
 * Tolerant of the same envelope shapes as the discovery OCDS adapter:
 *   { releases: [...] } | { results: [{ releases: [...] }] } | [ {release}, ... ]
 */

const MAX_ITEMS = 500;

type Json = Record<string, unknown>;
const obj = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const numOf = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); return Number.isFinite(n) ? n : null; }
  return null;
};

function collectReleases(payload: unknown): Json[] {
  const out: Json[] = [];
  const root = obj(payload);
  if (Array.isArray(payload)) {
    for (const r of payload) { const o = obj(r); if (o) out.push(o); }
  } else if (root && Array.isArray(root.releases)) {
    for (const r of root.releases) { const o = obj(r); if (o) out.push(o); }
  } else if (root && Array.isArray(root.results)) {
    for (const result of root.results) {
      const ro = obj(result);
      if (ro && Array.isArray(ro.releases)) for (const r of ro.releases) { const o = obj(r); if (o) out.push(o); }
      else if (ro) out.push(ro);
    }
  }
  return out;
}

function dateOf(v: unknown): Date | null {
  const s = str(v);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
}

function firstSupplierName(award: Json): string | null {
  for (const s of arr(award.suppliers)) {
    const name = str(obj(s)?.name);
    if (name) return name;
  }
  return null;
}

export function parseOcdsAwards(payload: unknown, source: GazetteAdapterSource): NormalizedAward[] {
  const releases = collectReleases(payload);
  const out: NormalizedAward[] = [];

  for (const rel of releases) {
    try {
      const ocid = str(rel.ocid) ?? str(rel.id);
      if (!ocid) continue;
      const tender = obj(rel.tender);
      const buyer = obj(rel.buyer) ?? obj(tender?.procuringEntity);
      const buyerName = str(buyer?.name);
      const sector = str(tender?.mainProcurementCategory);
      const bidderCount = numOf(tender?.numberOfTenderers);
      const releaseDate = dateOf(rel.date);

      const awards = arr(rel.awards);
      if (awards.length === 0) continue; // not an award release

      for (const aRaw of awards) {
        const award = obj(aRaw);
        if (!award) continue;
        // Only count actual awards — skip cancelled / unsuccessful / pending.
        const status = str(award.status);
        if (status && status !== "active") continue;

        const winnerName = firstSupplierName(award);
        const value = obj(award.value);
        const awardedValue = numOf(value?.amount);
        if (!winnerName && awardedValue == null) continue; // no useful signal

        out.push({
          externalId: `${ocid}:${str(award.id) ?? "0"}`.slice(0, 250),
          buyerName,
          winnerName,
          awardedValue,
          currency: str(value?.currency),
          sector,
          country: source.country ?? null,
          awardedAt: dateOf(award.date) ?? releaseDate,
          bidderCount: bidderCount != null && bidderCount > 0 ? Math.round(bidderCount) : null,
          sourceUrl: source.baseUrl,
        });
        if (out.length >= MAX_ITEMS) return out;
      }
    } catch {
      // Skip a malformed release; never fail the whole batch.
    }
  }
  return out;
}
