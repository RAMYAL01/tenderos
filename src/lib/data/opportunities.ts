import { db } from "@/lib/prisma";
import type { MatchTrackingStatus, OpportunityStatus, ContentLanguage } from "@prisma/client";

/**
 * Discovery read model.
 *
 * PURE READ — this layer NEVER writes the catalog and NEVER triggers matching
 * (matching is a bounded action; doing it on render would be a self-DoS, M8).
 * Reads only the calling org's OpportunityMatch rows joined to the GLOBAL
 * Opportunity. `convertedTenderId` is this org's own tender id (set only by our
 * same-org convert action), safe to return; we do NOT join the Tender row
 * (avoids any cross-tenant title leak, M2).
 */

export interface DiscoverItem {
  matchId: string;
  opportunityId: string;
  relevanceScore: number;
  scoreBreakdown: Record<string, number> | null;
  trackingStatus: MatchTrackingStatus;
  convertedTenderId: string | null;
  titleEn: string;
  titleAr: string | null;
  buyerName: string | null;
  country: string | null;
  sector: string | null;
  tenderType: string | null;
  estimatedValue: number | null;
  currency: string | null;
  closingDate: Date | null;
  publishedAt: Date | null;
  sourceUrl: string | null;
  language: ContentLanguage;
  status: OpportunityStatus;
}

/** The personalized feed: this org's matches, highest-relevance first. */
export async function getDiscoverFeed(orgId: string, limit = 100): Promise<DiscoverItem[]> {
  const rows = await db.opportunityMatch.findMany({
    where: { orgId, trackingStatus: { not: "DISMISSED" } },
    orderBy: [{ relevanceScore: "desc" }],
    take: limit,
    select: {
      id: true,
      opportunityId: true,
      relevanceScore: true,
      scoreBreakdown: true,
      trackingStatus: true,
      convertedTenderId: true,
      opportunity: {
        select: {
          titleEn: true,
          titleAr: true,
          buyerName: true,
          country: true,
          sector: true,
          tenderType: true,
          estimatedValue: true,
          currency: true,
          closingDate: true,
          publishedAt: true,
          sourceUrl: true,
          language: true,
          status: true,
        },
      },
    },
  });

  return rows.map((r) => ({
    matchId: r.id,
    opportunityId: r.opportunityId,
    relevanceScore: r.relevanceScore,
    scoreBreakdown: (r.scoreBreakdown as Record<string, number> | null) ?? null,
    trackingStatus: r.trackingStatus,
    convertedTenderId: r.convertedTenderId,
    titleEn: r.opportunity.titleEn,
    titleAr: r.opportunity.titleAr,
    buyerName: r.opportunity.buyerName,
    country: r.opportunity.country,
    sector: r.opportunity.sector,
    tenderType: r.opportunity.tenderType,
    estimatedValue: r.opportunity.estimatedValue ? Number(r.opportunity.estimatedValue.toString()) : null,
    currency: r.opportunity.currency,
    closingDate: r.opportunity.closingDate,
    publishedAt: r.opportunity.publishedAt,
    sourceUrl: r.opportunity.sourceUrl,
    language: r.opportunity.language,
    status: r.opportunity.status,
  }));
}

/** Whether the global catalog has any open opportunities at all (empty-state copy). */
export async function catalogHasOpportunities(): Promise<boolean> {
  const n = await db.opportunity.count({ where: { status: { in: ["OPEN", "CLOSING_SOON"] } } });
  return n > 0;
}
