/**
 * Programmatic SEO data model.
 *
 * Drives /tender-software/[industry]-in-[country] — one statically-generated,
 * keyword-targeted landing page per (industry × country) combination, capturing
 * long-tail intent like "EPC tender software in Saudi Arabia".
 *
 * Country context (procurement portal, local-content program, currency) is real
 * and specific, so each page is genuinely useful — not thin doorway content.
 */

export interface Industry {
  slug: string;
  name: string; // "Construction"
  noun: string; // "construction companies"
  pain: string; // industry-specific pain hook
}

export interface Country {
  slug: string;
  name: string; // "Saudi Arabia"
  currency: string; // "SAR"
  portal: string; // government e-procurement portal
  localContent: string; // local-content program
}

export const INDUSTRIES: Industry[] = [
  {
    slug: "construction",
    name: "Construction",
    noun: "construction and contracting firms",
    pain: "thousand-line BOQs buried in scanned, watermarked PDFs",
  },
  {
    slug: "epc",
    name: "EPC",
    noun: "EPC contractors",
    pain: "multi-discipline RFPs where a single mispriced line erodes the whole margin",
  },
  {
    slug: "facilities-management",
    name: "Facilities Management",
    noun: "facilities-management providers",
    pain: "multi-year FM scopes with hundreds of rate-card line items",
  },
  {
    slug: "infrastructure",
    name: "Infrastructure",
    noun: "infrastructure and civil-works contractors",
    pain: "mega-project tenders that span hundreds of pages and dozens of annexes",
  },
  {
    slug: "oil-and-gas",
    name: "Oil & Gas",
    noun: "oil, gas, and energy contractors",
    pain: "strict technical compliance matrices and aggressive local-content thresholds",
  },
];

export const COUNTRIES: Country[] = [
  { slug: "saudi-arabia", name: "Saudi Arabia", currency: "SAR", portal: "Etimad", localContent: "the Local Content (LCGPA) and iktva programs" },
  { slug: "uae", name: "the UAE", currency: "AED", portal: "the federal and emirate e-procurement portals", localContent: "In-Country Value (ICV)" },
  { slug: "qatar", name: "Qatar", currency: "QAR", portal: "Monaqasat", localContent: "the Tawteen local-content program" },
  { slug: "egypt", name: "Egypt", currency: "EGP", portal: "the Egyptian Government e-Procurement portal", localContent: "national local-content requirements" },
];

export interface Combo {
  slug: string; // "construction-in-saudi-arabia"
  industry: Industry;
  country: Country;
}

const COMBO_BY_SLUG: Map<string, Combo> = (() => {
  const map = new Map<string, Combo>();
  for (const industry of INDUSTRIES) {
    for (const country of COUNTRIES) {
      const slug = `${industry.slug}-in-${country.slug}`;
      map.set(slug, { slug, industry, country });
    }
  }
  return map;
})();

export function allCombos(): Combo[] {
  return [...COMBO_BY_SLUG.values()];
}

export function getCombo(slug: string): Combo | null {
  return COMBO_BY_SLUG.get(slug) ?? null;
}
