import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  ingestOpportunities,
  sweepExpiredOpportunities,
  sweepClosingSoonOpportunities,
  recordSourceHealth,
} from "@/lib/discovery/ingest";
import { matchOpportunityDeltaForOrg } from "@/lib/discovery/match";
import { ADAPTERS } from "@/lib/discovery/adapters";
import { enqueueOrgDigest } from "@/lib/email/digest";
import { drainEmailQueue } from "@/lib/email/email-queue";

/**
 * Daily discovery refresh (the cron's brain). Three bounded phases:
 *
 *  1. INGEST  — run each active source's adapter (idempotent upserts) and age
 *               out expired/closing-soon statuses (writes via ingest.ts only).
 *  2. MATCH   — delta re-match (audit M7): only opportunities CHANGED in the
 *               last window are re-scored, only for a bounded batch of orgs.
 *               O(deltaN × orgBatch), never O(catalog × allOrgs).
 *  3. ALERT   — for orgs with an alerts-enabled SavedSearch: digest their
 *               un-notified NEW high-relevance matches into one IN_APP
 *               OpportunityAlert, then stamp lastNotifiedAt (per-match dedup —
 *               a match is digested at most once, audit M10's 24h-window trap
 *               avoided by keying on lastNotifiedAt null, not a time cutoff).
 *
 * Runs daily at 06:00 UTC (≈09:00 Gulf — fixed, per-tenant timezones are not
 * possible under Vercel Hobby's daily-only crons; audit M11).
 */

// Bounds (M7) — tuned for Hobby's 300s maxDuration with headroom.
const DELTA_WINDOW_MS = 26 * 60 * 60 * 1000; // 26h: daily cadence + slack
const MAX_DELTA_OPPS = 300;
const MAX_ORGS_PER_RUN = 50;
const ALERT_MIN_SCORE = 0.35;
const ALERT_MAX_ITEMS = 10;

export interface RefreshSummary {
  sources: number;
  ingested: { inserted: number; updated: number; unchanged: number };
  swept: { closed: number; closingSoon: number };
  deltaOpportunities: number;
  orgsMatched: number;
  matchesUpserted: number;
  alertsCreated: number;
  digestEmailsQueued: number;
  digestEmailsSent: number;
}

export async function runDiscoveryRefresh(): Promise<RefreshSummary> {
  const summary: RefreshSummary = {
    sources: 0,
    ingested: { inserted: 0, updated: 0, unchanged: 0 },
    swept: { closed: 0, closingSoon: 0 },
    deltaOpportunities: 0,
    orgsMatched: 0,
    matchesUpserted: 0,
    alertsCreated: 0,
    digestEmailsQueued: 0,
    digestEmailsSent: 0,
  };

  // ── 1. INGEST ────────────────────────────────────────────────────────────────
  const sources = await db.opportunitySource.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, adapterKey: true, baseUrl: true, country: true, defaultLanguage: true },
  });
  for (const source of sources) {
    const adapter = ADAPTERS[source.adapterKey];
    if (!adapter) {
      logger.warn({ source: source.slug, adapterKey: source.adapterKey }, "discovery-refresh: no adapter");
      continue;
    }
    try {
      const items = await adapter(source);
      const res = await ingestOpportunities(source.id, items);
      summary.sources++;
      summary.ingested.inserted += res.inserted;
      summary.ingested.updated += res.updated;
      summary.ingested.unchanged += res.unchanged;
      await recordSourceHealth(source.id, { ok: true, itemCount: items.length });
    } catch (err) {
      logger.error({ err, source: source.slug }, "discovery-refresh: ingest failed");
      await recordSourceHealth(source.id, {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  summary.swept.closed = await sweepExpiredOpportunities();
  summary.swept.closingSoon = await sweepClosingSoonOpportunities();

  // ── 2. MATCH (delta only, M7) ────────────────────────────────────────────────
  const since = new Date(Date.now() - DELTA_WINDOW_MS);
  const delta = await db.opportunity.findMany({
    where: { updatedAt: { gte: since }, status: { in: ["OPEN", "CLOSING_SOON"] } },
    select: { id: true },
    orderBy: { closingDate: "asc" },
    take: MAX_DELTA_OPPS,
  });
  summary.deltaOpportunities = delta.length;

  if (delta.length > 0) {
    const deltaIds = delta.map((d) => d.id);
    const orgs = await db.organization.findMany({
      where: { isActive: true, deletedAt: null, onboardingCompletedAt: { not: null } },
      select: { id: true },
      orderBy: { updatedAt: "asc" }, // stalest-served-first; cursor upgrade when org count > batch
      take: MAX_ORGS_PER_RUN,
    });

    for (const org of orgs) {
      try {
        const res = await matchOpportunityDeltaForOrg(org.id, deltaIds);
        summary.orgsMatched++;
        summary.matchesUpserted += res.matched;
      } catch (err) {
        logger.error({ err, orgId: org.id }, "discovery-refresh: match failed");
      }
    }
  }

  // ── 3. ALERT (digest per org with an alerts-enabled monitor) ────────────────
  const monitors = await db.savedSearch.findMany({
    where: {
      alertsEnabled: true,
      deletedAt: null,
      // Defense in depth (applyPlanToOrg also disables on downgrade): never
      // digest for Starter, inactive, or deleted orgs.
      organization: {
        isActive: true,
        deletedAt: null,
        planTier: { not: "STARTER" },
      },
    },
    select: { id: true, orgId: true, organization: { select: { name: true } } },
    distinct: ["orgId"], // one digest per org per day
    take: MAX_ORGS_PER_RUN,
  });

  for (const monitor of monitors) {
    try {
      // Un-notified, high-relevance, still-suggested matches for THIS org.
      const fresh = await db.opportunityMatch.findMany({
        where: {
          orgId: monitor.orgId,
          trackingStatus: "NEW",
          lastNotifiedAt: null,
          relevanceScore: { gte: ALERT_MIN_SCORE },
        },
        orderBy: { relevanceScore: "desc" },
        take: ALERT_MAX_ITEMS,
        select: {
          id: true,
          relevanceScore: true,
          opportunity: {
            select: { id: true, titleEn: true, buyerName: true, country: true, closingDate: true },
          },
        },
      });
      if (fresh.length === 0) continue;

      await db.$transaction([
        db.opportunityAlert.create({
          data: {
            orgId: monitor.orgId,
            savedSearchId: monitor.id,
            channel: "IN_APP",
            status: "SENT",
            sentAt: new Date(),
            matchCount: fresh.length,
            payload: fresh.map((f) => ({
              opportunityId: f.opportunity.id,
              title: f.opportunity.titleEn,
              score: f.relevanceScore,
              closingDate: f.opportunity.closingDate?.toISOString() ?? null,
            })),
          },
        }),
        db.opportunityMatch.updateMany({
          where: { id: { in: fresh.map((f) => f.id) }, orgId: monitor.orgId },
          data: { lastNotifiedAt: new Date() },
        }),
      ]);
      summary.alertsCreated++;

      // Same deduped set → email digest. Enqueued now, drained after the loop.
      // No-ops cleanly when email is unconfigured or no member opted in.
      summary.digestEmailsQueued += await enqueueOrgDigest(
        { id: monitor.orgId, name: monitor.organization.name },
        fresh
      );
    } catch (err) {
      logger.error({ err, orgId: monitor.orgId }, "discovery-refresh: alert failed");
    }
  }

  // Drain the digest outbox in rate-limited batches (bounded for the cron budget).
  try {
    const drained = await drainEmailQueue();
    summary.digestEmailsSent = drained.sent;
  } catch (err) {
    logger.error({ err }, "discovery-refresh: email drain failed");
  }

  logger.info(summary, "discovery-refresh complete");
  return summary;
}
