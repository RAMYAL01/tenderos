import { createHash } from "crypto";
import type { ContentLanguage } from "@prisma/client";
import type { NormalizedOpportunity } from "@/lib/discovery/ingest";
import { fetchText, decodeEntities } from "./http";

/**
 * Generic RSS 2.0 / Atom adapter. Many procurement portals and tender
 * aggregators publish an RSS/Atom feed of new notices; point an
 * OpportunitySource at the feed URL (baseUrl) with adapterKey="rss".
 *
 * Tolerant string parser — no XML dependency. Coarse by design (title, link,
 * description, date); closing dates rarely appear in feeds, so they stay null
 * until enriched. Every item is mapped defensively; a malformed item is skipped,
 * never throws.
 */

export interface AdapterSource {
  id: string;
  slug: string;
  baseUrl: string | null;
  country: string | null;
  defaultLanguage: ContentLanguage;
}

const MAX_ITEMS = 100;

function tag(block: string, name: string): string | null {
  // Matches <name ...>...</name> (namespaced names supported via [\w:]).
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeEntities(m[1]) : null;
}

function attr(block: string, name: string, a: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*\\b${a}=["']([^"']+)["']`, "i"));
  return m ? m[1] : null;
}

function splitBlocks(xml: string, el: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${el}(?:\\s[^>]*)?>([\\s\\S]*?)</${el}>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) && out.length < MAX_ITEMS) out.push(m[1]);
  return out;
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
}

export async function fetchRssOpportunities(source: AdapterSource): Promise<NormalizedOpportunity[]> {
  if (!source.baseUrl) throw new Error(`RSS source ${source.slug} has no baseUrl`);
  return parseRss(await fetchText(source.baseUrl), source);
}

/** Pure parse (network-free, unit-tested). */
export function parseRss(xml: string, source: AdapterSource): NormalizedOpportunity[] {
  // RSS <item> first; fall back to Atom <entry>.
  let blocks = splitBlocks(xml, "item");
  const isAtom = blocks.length === 0;
  if (isAtom) blocks = splitBlocks(xml, "entry");

  const items: NormalizedOpportunity[] = [];
  for (const block of blocks) {
    try {
      const title = tag(block, "title");
      if (!title || title.length < 3) continue;

      const link = isAtom
        ? attr(block, "link", "href") ?? tag(block, "id")
        : tag(block, "link") ?? tag(block, "guid");

      const description =
        tag(block, "description") ?? tag(block, "summary") ?? tag(block, "content") ?? null;

      const published = parseDate(
        isAtom ? tag(block, "updated") ?? tag(block, "published") : tag(block, "pubDate")
      );

      // Stable external id: explicit guid/id, else a hash of link|title.
      const rawId = (isAtom ? tag(block, "id") : tag(block, "guid")) ?? link ?? title;
      const externalId = createHash("sha1").update(rawId).digest("hex").slice(0, 32);

      items.push({
        externalId,
        titleEn: title.slice(0, 500),
        descriptionEn: description ? description.slice(0, 4000) : null,
        country: source.country ?? null,
        sector: null, // unknown from a generic feed — classifier is a later step
        tenderType: null,
        publishedAt: published,
        closingDate: null,
        sourceUrl: link,
        language: source.defaultLanguage,
        raw: { title, link, description, source: source.slug },
      });
    } catch {
      // Skip a malformed item; never fail the whole feed.
    }
  }
  return items;
}
