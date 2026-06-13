import type { NormalizedOpportunity } from "@/lib/discovery/ingest";
import type { AdapterSource } from "./rss";
import { postJson, decodeEntities } from "./http";

/**
 * TED (Tenders Electronic Daily) adapter — the EU's official procurement journal,
 * second REAL source. Documented POST API (api.ted.europa.eu/v3/notices/search),
 * legal, no auth. Carries EU + EU-external-action tenders, including real MENA
 * construction / engineering / facilities works (e.g. EU-delegation and member-
 * state projects across Egypt, the Maghreb, Jordan, the Gulf).
 *
 * The eForms model is multilingual + per-lot; we extract an English-preferred
 * value and the first MENA place-of-performance. scope:"ACTIVE" returns only
 * currently-open notices. The query (CPV + MENA places) lives here, not in the
 * URL, because TED is a POST search.
 */

const TED_FIELDS = [
  "publication-number",
  "notice-title",
  "buyer-name",
  "place-of-performance",
  "deadline-receipt-tender-date-lot",
  "publication-date",
  "classification-cpv",
  "description-lot",
  "notice-type",
];

// 3-letter ISO place codes TED uses → our 2-letter, restricted to MENA.
const MENA_3TO2: Record<string, string> = {
  EGY: "EG", MAR: "MA", TUN: "TN", DZA: "DZ", LBY: "LY", JOR: "JO", LBN: "LB",
  IRQ: "IQ", SAU: "SA", ARE: "AE", QAT: "QA", KWT: "KW", OMN: "OM", BHR: "BH",
  YEM: "YE", DJI: "DJ", PSE: "PS",
};

// CPV division (first 2 digits) → our coarse sector hint.
const CPV_SECTOR: Record<string, string> = {
  "45": "construction", // construction work
  "71": "consulting", // architectural / engineering services
  "50": "services", // repair & maintenance (facilities)
  "09": "oil_gas", // petroleum / fuels / energy
};

const MAX_ITEMS = 200;

function buildQuery(): Record<string, unknown> {
  const places = Object.keys(MENA_3TO2).join(" ");
  return {
    query: `classification-cpv IN (45000000 71000000 50000000 09000000) AND place-of-performance IN (${places})`,
    fields: TED_FIELDS,
    scope: "ACTIVE", // currently-open notices only
    limit: MAX_ITEMS,
    page: 1,
  };
}

/** TED values are multilingual ({eng:[...], fra:[...]}) or arrays or strings. */
function ml(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (Array.isArray(v)) {
    const s = v.find((x) => typeof x === "string" && x.trim());
    return s ? (s as string).trim() : null;
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of ["eng", "ENG", "en", "fra", "FRA", "fr", "ara", "ARA", "ar"]) {
      if (k in o) {
        const r = ml(o[k]);
        if (r) return r;
      }
    }
    for (const k of Object.keys(o)) {
      const r = ml(o[k]);
      if (r) return r;
    }
  }
  return null;
}

function menaCountry(place: unknown): string | null {
  if (!Array.isArray(place)) return null;
  for (const code of place) {
    if (typeof code === "string" && MENA_3TO2[code]) return MENA_3TO2[code];
  }
  return null;
}

function dateOf(v: unknown): Date | null {
  const s = Array.isArray(v) ? (typeof v[0] === "string" ? v[0] : null) : typeof v === "string" ? v : null;
  if (!s) return null;
  // TED emits date-only with a trailing Z, e.g. "2025-09-01Z" → make it valid ISO.
  const norm = /^\d{4}-\d{2}-\d{2}Z$/.test(s) ? s.replace("Z", "T00:00:00Z") : s;
  const t = Date.parse(norm);
  return Number.isNaN(t) ? null : new Date(t);
}

function sectorFromCpv(v: unknown): string | null {
  const cpv = ml(v) ?? (Array.isArray(v) && v[0] != null ? String(v[0]) : null);
  if (!cpv) return null;
  return CPV_SECTOR[cpv.slice(0, 2)] ?? null;
}

export async function fetchTedOpportunities(source: AdapterSource): Promise<NormalizedOpportunity[]> {
  if (!source.baseUrl) throw new Error(`TED source ${source.slug} has no baseUrl`);
  return parseTed(await postJson(source.baseUrl, buildQuery()), source);
}

/** Pure parse (network-free, unit-tested). */
export function parseTed(payload: unknown, source: AdapterSource): NormalizedOpportunity[] {
  const root = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const notices = Array.isArray(root.notices) ? (root.notices as Record<string, unknown>[]) : [];

  const items: NormalizedOpportunity[] = [];
  for (const n of notices.slice(0, MAX_ITEMS)) {
    try {
      const country = menaCountry(n["place-of-performance"]);
      if (!country) continue; // MENA-only (TED notices carry mixed EU + target places)

      const externalId = ml(n["publication-number"]);
      if (!externalId) continue;

      const title = ml(n["notice-title"]) ?? ml(n["description-lot"]);
      if (!title || title.length < 3) continue;

      const description = ml(n["description-lot"]);

      items.push({
        externalId,
        titleEn: title.slice(0, 500),
        descriptionEn: description ? decodeEntities(description).slice(0, 4000) : null,
        buyerName: ml(n["buyer-name"]),
        country,
        sector: sectorFromCpv(n["classification-cpv"]),
        tenderType: ml(n["notice-type"]),
        referenceNo: externalId,
        estimatedValue: null,
        currency: null,
        publishedAt: dateOf(n["publication-date"]),
        closingDate: dateOf(n["deadline-receipt-tender-date-lot"]),
        sourceUrl: `https://ted.europa.eu/en/notice/${externalId}`,
        language: source.defaultLanguage,
        raw: { publicationNumber: externalId, source: source.slug },
      });
    } catch {
      // Skip a malformed notice; never fail the whole batch.
    }
  }
  return items;
}
