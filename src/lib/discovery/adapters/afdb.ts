import type { NormalizedOpportunity } from "@/lib/discovery/ingest";
import { parseRss, type AdapterSource } from "./rss";
import { fetchText } from "./http";

/**
 * African Development Bank (AfDB) adapter — third REAL source, for North-Africa
 * MENA. AfDB publishes project-procurement notices as an RSS feed
 * (afdb.org/en/projects-and-operations/procurement.xml). We REUSE the generic
 * RSS parser and add the one AfDB-specific bit: the country sits in the title,
 * e.g. "EOI - Egypt - …" / "AAO - Maroc - …", so we extract it and keep only
 * North-Africa MENA.
 *
 * Note: the feed is a rolling window of ~20 recent pan-African notices, and
 * North-Africa is intermittent — so this is a passive collector that accumulates
 * North-Africa tenders across daily polls, not a big one-shot batch.
 */

// Country-in-title → ISO, North-Africa MENA, EN + FR spellings (AfDB is bilingual).
const NORTH_AFRICA: Record<string, string> = {
  egypt: "EG", égypte: "EG", egypte: "EG",
  morocco: "MA", maroc: "MA",
  tunisia: "TN", tunisie: "TN",
  algeria: "DZ", algérie: "DZ", algerie: "DZ",
  libya: "LY", libye: "LY",
  djibouti: "DJ",
  mauritania: "MR", mauritanie: "MR",
  sudan: "SD", soudan: "SD",
};

/** AfDB titles are "{TYPE} - {Country} - {rest}", e.g. "EOI - Egypt - …". */
function fromTitle(title: string): { country: string | null; type: string | null } {
  const parts = title.split(" - ");
  if (parts.length < 2) return { country: null, type: null };
  return { country: NORTH_AFRICA[parts[1].trim().toLowerCase()] ?? null, type: parts[0].trim() || null };
}

export async function fetchAfdbOpportunities(source: AdapterSource): Promise<NormalizedOpportunity[]> {
  if (!source.baseUrl) throw new Error(`AfDB source ${source.slug} has no baseUrl`);
  return parseAfdb(await fetchText(source.baseUrl), source);
}

/** Pure parse (network-free, unit-tested) — reuses parseRss, filters to N. Africa. */
export function parseAfdb(xml: string, source: AdapterSource): NormalizedOpportunity[] {
  const out: NormalizedOpportunity[] = [];
  for (const item of parseRss(xml, source)) {
    const { country, type } = fromTitle(item.titleEn);
    if (!country) continue; // North-Africa MENA only
    out.push({ ...item, country, tenderType: type ?? item.tenderType });
  }
  return out;
}
