import type { NormalizedOpportunity } from "@/lib/discovery/ingest";
import type { AdapterSource } from "./rss";
import { fetchJson, decodeEntities } from "./http";

/**
 * World Bank Procurement Notices adapter — the first REAL source.
 *
 * Why this one first: the World Bank publishes financed-project tender notices
 * via an OPEN, documented JSON API (search.worldbank.org/api/v2/procnotices) —
 * legal, reliable, no auth, and rich with MENA construction / civil-works /
 * consulting tenders. It proves the whole real-ingestion pipeline end-to-end
 * today. (GCC states rarely borrow from the WB, so this skews Egypt + developing
 * MENA; GCC depth comes from national-portal agreements later.)
 *
 * Point an OpportunitySource at the procnotices endpoint with adapterKey
 * "worldbank". The adapter filters to MENA in-code, so the URL just controls
 * batch size / recency.
 */

const MAX_ITEMS = 600;

// project_ctry_name → ISO-2, restricted to MENA (the served market + region).
// Extend freely — each entry is one more country's tenders.
const MENA_COUNTRY: Record<string, string> = {
  "saudi arabia": "SA",
  "united arab emirates": "AE",
  qatar: "QA",
  kuwait: "KW",
  oman: "OM",
  egypt: "EG",
  "egypt, arab republic of": "EG",
  jordan: "JO",
  iraq: "IQ",
  lebanon: "LB",
  morocco: "MA",
  tunisia: "TN",
  algeria: "DZ",
  bahrain: "BH",
  "yemen, republic of": "YE",
  yemen: "YE",
  libya: "LY",
  djibouti: "DJ",
  "west bank and gaza": "PS",
};

// World Bank procurement_group → our coarse sector hint. (Full AI sector
// classification is the Phase-4 enrichment stage; this is the deterministic floor.)
const GROUP_SECTOR: Record<string, string> = {
  CW: "construction", // Civil Works
  CS: "consulting", // Consulting Services
  NC: "services", // Non-consulting Services
  GO: "supply", // Goods
};

type Json = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** WB dates come as "12-Jun-2026" or ISO "2026-07-16T00:00:00Z". */
function dateOf(v: unknown): Date | null {
  const s = str(v);
  if (!s) return null;
  const t = Date.parse(s.includes("-") && !s.includes("T") ? s.replace(/-/g, " ") : s);
  return Number.isNaN(t) ? null : new Date(t);
}

function stripHtml(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  return decodeEntities(s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim() || null;
}

export async function fetchWorldBankOpportunities(source: AdapterSource): Promise<NormalizedOpportunity[]> {
  if (!source.baseUrl) throw new Error(`World Bank source ${source.slug} has no baseUrl`);
  return parseWorldBank(await fetchJson(source.baseUrl), source);
}

/** Pure parse (network-free, unit-tested). */
export function parseWorldBank(payload: unknown, source: AdapterSource): NormalizedOpportunity[] {
  const root = (payload && typeof payload === "object" ? payload : {}) as Json;
  const notices = Array.isArray(root.procnotices) ? (root.procnotices as Json[]) : [];

  const items: NormalizedOpportunity[] = [];
  for (const n of notices.slice(0, MAX_ITEMS)) {
    try {
      // Active notices only — cancelled/closed are aged out by the sweep anyway.
      const noticeStatus = str(n.notice_status);
      if (noticeStatus && noticeStatus.toLowerCase() !== "published") continue;

      const ctryName = (str(n.project_ctry_name) ?? str(n.contact_ctry_name) ?? "").toLowerCase();
      const country = MENA_COUNTRY[ctryName];
      if (!country) continue; // MENA-only

      const externalId = str(n.id);
      if (!externalId) continue;

      const title = str(n.bid_description) ?? str(n.project_name);
      if (!title || title.length < 3) continue;

      const projectId = str(n.project_id);
      const group = str(n.procurement_group)?.toUpperCase();

      items.push({
        externalId,
        titleEn: title.slice(0, 500),
        descriptionEn:
          (stripHtml(n.notice_text) ?? str(n.bid_description) ?? "").slice(0, 4000) || null,
        buyerName: str(n.contact_organization),
        country,
        sector: group ? GROUP_SECTOR[group] ?? null : null,
        tenderType: str(n.procurement_method_name) ?? str(n.notice_type),
        referenceNo: str(n.bid_reference_no) ?? externalId,
        estimatedValue: null, // WB notices don't carry an estimate at notice stage
        currency: null,
        publishedAt: dateOf(n.noticedate),
        closingDate: dateOf(n.submission_deadline_date),
        sourceUrl: projectId
          ? `https://projects.worldbank.org/en/projects-operations/project-detail/${projectId}`
          : source.baseUrl,
        language: source.defaultLanguage,
        raw: { id: externalId, projectId, group, source: source.slug },
      });
    } catch {
      // Skip a malformed notice; never fail the whole batch.
    }
  }
  return items;
}
