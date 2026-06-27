import { db } from "@/lib/prisma";

/**
 * Entity resolution for the benchmark network (Wave 1, item 2).
 *
 * Free-text competitor/buyer names arrive in Arabic and English with diacritics,
 * transliteration variants, and legal-entity suffixes — the same firm otherwise
 * lands as five rows and poisons the benchmark. normalizeEntityName produces a
 * stable dedup key; resolveCompetitor / resolveBuyer find-or-create the canonical
 * entity and accumulate every raw spelling as an alias.
 *
 * SANCTIONED GLOBAL WRITER — this file (with contribute.ts) is the only place
 * allowed to write the global Competitor / Buyer tables (isolation guard).
 */

const LEGAL_SUFFIXES_EN = new Set([
  "llc", "ltd", "limited", "co", "company", "corp", "corporation", "inc",
  "plc", "wll", "est", "establishment", "group", "holding", "holdings",
  "contracting", "trading", "international", "intl", "and", "the", "for",
]);

const LEGAL_SUFFIXES_AR = [
  "ش.م.م", "ذ.م.م", "ش.ذ.م.م", "ش.م.ب", "ش.م.ك", "ش.م.خ",
  "شركة", "مؤسسة", "مجموعة", "القابضة", "المحدودة", "للمقاولات", "للتجارة", "والمقاولات",
];

/** Normalize a firm/buyer name (AR or EN) into a stable dedup key. */
export function normalizeEntityName(raw: string): { key: string; isArabic: boolean } {
  const original = (raw || "").trim();
  const isArabic = /[؀-ۿ]/.test(original);
  let s = original;

  if (isArabic) {
    // Strip harakat + tatweel; unify alef / ya / waw-hamza / ta-marbuta.
    s = s
      .replace(/[ً-ْٰـ]/g, "")
      .replace(/[إأآا]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/[ؤئ]/g, "ي")
      .replace(/ة/g, "ه");
    for (const suf of LEGAL_SUFFIXES_AR) s = s.split(suf).join(" ");
  } else {
    s = s.toLowerCase().replace(/[.,&/\\()'"’\-_]/g, " ");
    const tokens = s.split(/\s+/).filter((t) => t && !LEGAL_SUFFIXES_EN.has(t));
    s = tokens.join(" ");
  }

  s = s.replace(/\s+/g, " ").trim();
  return { key: s || original.toLowerCase(), isArabic };
}

/** Find-or-create a canonical Competitor; returns its id (or null for empty input). */
export async function resolveCompetitor(rawName: string, country?: string | null): Promise<string | null> {
  const name = (rawName || "").trim();
  if (!name) return null;
  const { key, isArabic } = normalizeEntityName(name);

  const existing = await db.competitor.findUnique({ where: { normalizedKey: key } });
  if (existing) {
    if (!existing.aliases.includes(name)) {
      await db.competitor.update({ where: { id: existing.id }, data: { aliases: { push: name } } }).catch(() => {});
    }
    return existing.id;
  }
  try {
    const created = await db.competitor.create({
      data: { canonicalName: name, canonicalNameAr: isArabic ? name : null, normalizedKey: key, aliases: [name], country: country ?? null },
    });
    return created.id;
  } catch {
    // unique-constraint race: another contribution created it first
    const raced = await db.competitor.findUnique({ where: { normalizedKey: key } });
    return raced?.id ?? null;
  }
}

/** Find-or-create a canonical Buyer (gov entity); returns its id. */
export async function resolveBuyer(rawName: string, country?: string | null, sector?: string | null): Promise<string | null> {
  const name = (rawName || "").trim();
  if (!name) return null;
  const { key, isArabic } = normalizeEntityName(name);

  const existing = await db.buyer.findUnique({ where: { normalizedKey: key } });
  if (existing) {
    if (!existing.aliases.includes(name)) {
      await db.buyer.update({ where: { id: existing.id }, data: { aliases: { push: name } } }).catch(() => {});
    }
    return existing.id;
  }
  try {
    const created = await db.buyer.create({
      data: { canonicalName: name, canonicalNameAr: isArabic ? name : null, normalizedKey: key, aliases: [name], country: country ?? null, sector: sector ?? null },
    });
    return created.id;
  } catch {
    const raced = await db.buyer.findUnique({ where: { normalizedKey: key } });
    return raced?.id ?? null;
  }
}
