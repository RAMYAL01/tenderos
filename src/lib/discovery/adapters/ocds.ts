import type { NormalizedOpportunity } from "@/lib/discovery/ingest";
import type { AdapterSource } from "./rss";
import { fetchJson } from "./http";

/**
 * OCDS (Open Contracting Data Standard) adapter — the real machine-readable
 * standard many government procurement portals expose (e.g. UK Contracts
 * Finder, and a growing number of national systems). Point an
 * OpportunitySource at an OCDS releases/search endpoint with adapterKey="ocds".
 *
 * Tolerant of the common envelope shapes:
 *   { releases: [...] }                         (release package)
 *   { results: [{ releases: [...] }] }          (search results, e.g. CF)
 *   [ { ocid, tender, buyer, ... }, ... ]       (bare release array)
 */

const MAX_ITEMS = 200;

type Json = Record<string, unknown>;
const obj = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const numOf = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

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
      if (ro && Array.isArray(ro.releases)) {
        for (const r of ro.releases) { const o = obj(r); if (o) out.push(o); }
      } else if (ro) {
        out.push(ro);
      }
    }
  }
  return out.slice(0, MAX_ITEMS);
}

function dateOf(v: unknown): Date | null {
  const s = str(v);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
}

/** OCDS tender.documents[].url — the first usable link, if any. */
function firstDocumentUrl(docs: unknown): string | null {
  if (!Array.isArray(docs)) return null;
  for (const d of docs) {
    const u = str(obj(d)?.url);
    if (u) return u;
  }
  return null;
}

export async function fetchOcdsOpportunities(source: AdapterSource): Promise<NormalizedOpportunity[]> {
  if (!source.baseUrl) throw new Error(`OCDS source ${source.slug} has no baseUrl`);
  return parseOcds(await fetchJson(source.baseUrl), source);
}

/** Pure parse (network-free, unit-tested). */
export function parseOcds(payload: unknown, source: AdapterSource): NormalizedOpportunity[] {
  const releases = collectReleases(payload);

  const items: NormalizedOpportunity[] = [];
  for (const rel of releases) {
    try {
      const tender = obj(rel.tender);
      const title = str(tender?.title) ?? str(rel.title);
      if (!title || title.length < 3) continue;

      const ocid = str(rel.ocid) ?? str(rel.id);
      if (!ocid) continue;

      const value = obj(tender?.value);
      const tenderPeriod = obj(tender?.tenderPeriod);
      const buyer = obj(rel.buyer);

      items.push({
        externalId: ocid.slice(0, 200),
        titleEn: title.slice(0, 500),
        descriptionEn: (str(tender?.description) ?? "").slice(0, 4000) || null,
        buyerName: str(buyer?.name),
        country: source.country ?? null,
        sector: str(tender?.mainProcurementCategory),
        tenderType: str(tender?.procurementMethod),
        referenceNo: str(tender?.id) ?? ocid,
        estimatedValue: numOf(value?.amount),
        currency: str(value?.currency),
        publishedAt: dateOf(rel.date),
        closingDate: dateOf(tenderPeriod?.endDate),
        sourceUrl: firstDocumentUrl(tender?.documents) ?? source.baseUrl,
        language: source.defaultLanguage,
        raw: { ocid, source: source.slug },
      });
    } catch {
      // Skip a malformed release; never fail the whole batch.
    }
  }
  return items;
}
