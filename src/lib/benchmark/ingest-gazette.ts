import { db } from "@/lib/prisma";
import { DEAD_SOURCE_THRESHOLD } from "@/lib/discovery/ingest";
import { resolveCompetitor, resolveBuyer } from "./entities";
import { toValueBand } from "./bands";
import { GAZETTE_ADAPTERS } from "./gazette";
import type { NormalizedAward } from "./gazette/types";

/**
 * Gazette ingestion (Wave 1, item 4) — pulls public AWARD notices into the global
 * AwardOutcome pool as GAZETTE outcomes (anonymized by construction — public data,
 * no contributor), entity-resolved + idempotent per notice. The supply side that
 * fills the benchmark independent of customer count.
 *
 * SANCTIONED GLOBAL WRITER — the only module besides contribute.ts / entities.ts
 * permitted to write the benchmark catalogs, and the only writer of GazetteSource
 * (isolation guard).
 */

async function ingestOne(award: NormalizedAward, gazetteSourceId: string): Promise<void> {
  if (!award.winnerName && award.awardedValue == null && !award.buyerName) return;

  const buyerId = award.buyerName ? await resolveBuyer(award.buyerName, award.country, award.sector) : null;
  const competitorId = award.winnerName ? await resolveCompetitor(award.winnerName, award.country) : null;
  const awardedValueMinor =
    award.awardedValue != null && Number.isFinite(award.awardedValue)
      ? BigInt(Math.round(award.awardedValue * 100))
      : null;
  const externalKey = `${gazetteSourceId}:${award.externalId}`.slice(0, 300);

  const data = {
    sector: award.sector ?? null,
    country: award.country ?? null,
    buyerId,
    buyerNameRaw: award.buyerName ?? null,
    competitorId,
    winnerNameRaw: award.winnerName ?? null,
    awardedValueMinor,
    currency: award.currency ?? null,
    valueBand: toValueBand(awardedValueMinor),
    bidderCount: award.bidderCount ?? null,
    awardedAt: award.awardedAt ?? null,
  };

  await db.awardOutcome.upsert({
    where: { externalKey },
    create: { ...data, outcomeType: "AWARDED", sourceType: "GAZETTE", externalKey, gazetteSourceId },
    update: data,
  });
}

/** Mirror of discovery recordSourceHealth, for GazetteSource (sanctioned writer). */
async function recordGazetteSourceHealth(
  sourceId: string,
  result: { ok: true; itemCount: number } | { ok: false; error: string }
): Promise<void> {
  try {
    await db.gazetteSource.update({
      where: { id: sourceId },
      data: result.ok
        ? { lastPolledAt: new Date(), lastSuccessAt: new Date(), lastItemCount: result.itemCount, consecutiveFailures: 0, lastError: null }
        : { lastPolledAt: new Date(), lastError: result.error.slice(0, 1000), consecutiveFailures: { increment: 1 } },
    });
  } catch {
    // health bookkeeping must never break the run
  }
}

export interface GazetteRunSummary {
  sources: number;
  awards: number;
  errors: number;
}

/** Run all active gazette sources → pool their awards. Bounded + fail-isolated. */
export async function runGazetteIngestion(): Promise<GazetteRunSummary> {
  const sources = await db.gazetteSource.findMany({ where: { isActive: true } });
  let awards = 0;
  let errors = 0;

  for (const source of sources) {
    const adapter = GAZETTE_ADAPTERS[source.adapterKey];
    if (!adapter) {
      await recordGazetteSourceHealth(source.id, { ok: false, error: `no adapter for "${source.adapterKey}"` });
      errors++;
      continue;
    }
    try {
      const items = await adapter({
        id: source.id,
        slug: source.slug,
        baseUrl: source.baseUrl,
        country: source.country,
        defaultLanguage: source.defaultLanguage,
      });
      let n = 0;
      for (const a of items) {
        await ingestOne(a, source.id);
        n++;
      }
      await recordGazetteSourceHealth(source.id, { ok: true, itemCount: n });
      awards += n;
    } catch (err) {
      await recordGazetteSourceHealth(source.id, { ok: false, error: err instanceof Error ? err.message : String(err) });
      errors++;
    }
  }

  return { sources: sources.length, awards, errors };
}

/** Auto-disable dead gazette sources (same policy as the discovery catalog). */
export async function autoDisableDeadGazetteSources(): Promise<string[]> {
  const dead = await db.gazetteSource.findMany({
    where: { isActive: true, consecutiveFailures: { gte: DEAD_SOURCE_THRESHOLD } },
    select: { id: true, slug: true },
  });
  if (dead.length === 0) return [];
  await db.gazetteSource.updateMany({
    where: { id: { in: dead.map((d) => d.id) } },
    data: { isActive: false },
  });
  return dead.map((d) => d.slug);
}
