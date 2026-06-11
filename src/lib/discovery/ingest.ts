import { createHash } from "crypto";
import type { ContentLanguage, OpportunityStatus } from "@prisma/client";
import { db } from "@/lib/prisma";

/**
 * Tender Discovery — ingestion worker.
 *
 * ⚠ ISOLATION CONTRACT: THIS IS THE ONLY MODULE PERMITTED TO WRITE THE GLOBAL
 * CATALOG (Opportunity / OpportunitySource). Enforced by a CI guard test
 * (src/lib/discovery/__tests__/isolation.test.ts) that fails the build if
 * `db.opportunity.` / `db.opportunitySource.` writes appear anywhere else.
 *
 * The catalog is shared, public, read-only to tenants. NOTHING tenant-derived
 * (org keywords, profile terms, "N orgs tracking") is ever written here — that
 * would leak across tenants. Only objective source data from public portals.
 *
 * Idempotent: upsert keyed on (sourceId, externalId); `contentHash` detects
 * changes so re-ingesting the same feed updates in place — no duplicates.
 */

export interface NormalizedOpportunity {
  externalId: string;
  titleEn: string;
  titleAr?: string | null;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  buyerName?: string | null;
  buyerNameAr?: string | null;
  country?: string | null; // 2-char
  sector?: string | null;
  tenderType?: string | null;
  referenceNo?: string | null;
  estimatedValue?: number | null;
  currency?: string | null; // 3-char
  publishedAt?: Date | null;
  closingDate?: Date | null;
  sourceUrl?: string | null;
  language?: ContentLanguage;
  raw: unknown;
}

function hashOpportunity(o: NormalizedOpportunity): string {
  const material = JSON.stringify([
    o.titleEn, o.titleAr, o.descriptionEn, o.buyerName, o.country, o.sector,
    o.tenderType, o.referenceNo, o.estimatedValue, o.currency,
    o.closingDate?.toISOString() ?? null,
  ]);
  return createHash("sha256").update(material).digest("hex");
}

/** Derive status from the closing date so the feed self-ages without a cron. */
function deriveStatus(closingDate?: Date | null): OpportunityStatus {
  if (!closingDate) return "OPEN";
  const ms = closingDate.getTime() - Date.now();
  if (ms <= 0) return "CLOSED";
  if (ms <= 7 * 24 * 60 * 60 * 1000) return "CLOSING_SOON";
  return "OPEN";
}

export interface IngestResult {
  source: string;
  inserted: number;
  updated: number;
  unchanged: number;
}

/**
 * Upsert a batch of normalized opportunities for one source. The single,
 * authoritative write path into the global catalog.
 */
export async function ingestOpportunities(
  sourceId: string,
  items: NormalizedOpportunity[]
): Promise<IngestResult> {
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  for (const item of items) {
    const contentHash = hashOpportunity(item);
    const existing = await db.opportunity.findUnique({
      where: { sourceId_externalId: { sourceId, externalId: item.externalId } },
      select: { id: true, contentHash: true },
    });

    if (existing && existing.contentHash === contentHash) {
      unchanged++;
      continue;
    }

    const data = {
      titleEn: item.titleEn,
      titleAr: item.titleAr ?? null,
      descriptionEn: item.descriptionEn ?? null,
      descriptionAr: item.descriptionAr ?? null,
      buyerName: item.buyerName ?? null,
      buyerNameAr: item.buyerNameAr ?? null,
      country: item.country ? item.country.slice(0, 2).toUpperCase() : null,
      sector: item.sector ?? null,
      tenderType: item.tenderType ?? null,
      referenceNo: item.referenceNo ?? null,
      estimatedValue: item.estimatedValue ?? null,
      currency: item.currency ? item.currency.slice(0, 3).toUpperCase() : null,
      publishedAt: item.publishedAt ?? null,
      closingDate: item.closingDate ?? null,
      sourceUrl: item.sourceUrl ?? null,
      language: item.language ?? ("EN" as ContentLanguage),
      contentHash,
      status: deriveStatus(item.closingDate),
      rawPayload: JSON.parse(JSON.stringify(item.raw ?? {})),
    };

    await db.opportunity.upsert({
      where: { sourceId_externalId: { sourceId, externalId: item.externalId } },
      create: { sourceId, externalId: item.externalId, ...data },
      update: data,
    });

    if (existing) updated++;
    else inserted++;
  }

  await db.opportunitySource.update({
    where: { id: sourceId },
    data: { lastPolledAt: new Date() },
  });

  return { source: sourceId, inserted, updated, unchanged };
}

/**
 * Age out expired opportunities (closingDate passed → CLOSED). Lives HERE
 * because ingest.ts is the only module allowed to write the global catalog.
 * Called by the daily refresh cron.
 */
export async function sweepExpiredOpportunities(): Promise<number> {
  const res = await db.opportunity.updateMany({
    where: { status: { in: ["OPEN", "CLOSING_SOON"] }, closingDate: { lt: new Date() } },
    data: { status: "CLOSED" },
  });
  return res.count;
}

/** Mark opportunities entering their final week as CLOSING_SOON. */
export async function sweepClosingSoonOpportunities(): Promise<number> {
  const inSevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const res = await db.opportunity.updateMany({
    where: { status: "OPEN", closingDate: { gte: new Date(), lte: inSevenDays } },
    data: { status: "CLOSING_SOON" },
  });
  return res.count;
}

/** Register (or fetch) a source. The only creator of OpportunitySource rows. */
export async function upsertSource(input: {
  slug: string;
  name: string;
  kind: "GOVERNMENT_PORTAL" | "AGGREGATOR" | "RSS" | "API" | "MANUAL";
  adapterKey: string;
  country?: string | null;
  baseUrl?: string | null;
  defaultLanguage?: ContentLanguage;
}): Promise<{ id: string }> {
  const row = await db.opportunitySource.upsert({
    where: { slug: input.slug },
    create: {
      slug: input.slug,
      name: input.name,
      kind: input.kind,
      adapterKey: input.adapterKey,
      country: input.country ?? null,
      baseUrl: input.baseUrl ?? null,
      defaultLanguage: input.defaultLanguage ?? "EN",
    },
    update: { name: input.name, adapterKey: input.adapterKey, baseUrl: input.baseUrl ?? null },
    select: { id: true },
  });
  return row;
}
