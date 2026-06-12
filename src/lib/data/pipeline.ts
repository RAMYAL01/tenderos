import { db } from "@/lib/prisma";

/**
 * Capture Pipeline read model (pure read, org-scoped).
 *
 * Columns DERIVE from Tender.status — the board is a view, not a second state
 * machine, so it can never drift from the data:
 *   Qualifying = DRAFT · Bidding = ACTIVE · Submitted = SUBMITTED
 *   Closed     = WON / LOST / NO_DECISION / CANCELLED
 * Plus a "Discovered" rail of SAVED (not yet converted) opportunity matches,
 * tying Discovery into the same operating view.
 */

export interface PipelineCard {
  id: string;
  titleEn: string;
  titleAr: string | null;
  clientName: string | null;
  status: string;
  sector: string | null;
  submissionDeadline: string | null; // ISO
  estimatedValue: number | null;
  currency: string;
  proposals: number;
  requirements: number;
  bid: {
    score: number;
    recommendation: "BID" | "NO_BID" | "REVIEW";
    humanDecision: "BID" | "NO_BID" | null;
  } | null;
}

export interface DiscoveredCard {
  matchId: string;
  titleEn: string;
  buyerName: string | null;
  closingDate: string | null; // ISO
  relevanceScore: number;
}

export interface PipelineData {
  discovered: DiscoveredCard[];
  qualifying: PipelineCard[];
  bidding: PipelineCard[];
  submitted: PipelineCard[];
  closed: PipelineCard[];
  totals: { count: number; activeValue: number; currency: string };
}

export async function getPipeline(orgId: string): Promise<PipelineData> {
  const [tenders, savedMatches] = await Promise.all([
    db.tender.findMany({
      where: { orgId, deletedAt: null },
      orderBy: [{ submissionDeadline: "asc" }, { updatedAt: "desc" }],
      take: 500,
      select: {
        id: true,
        titleEn: true,
        titleAr: true,
        clientName: true,
        status: true,
        sector: true,
        submissionDeadline: true,
        estimatedValue: true,
        currency: true,
        _count: { select: { proposals: true, requirements: true } },
        bidDecision: {
          select: { score: true, recommendation: true, humanDecision: true },
        },
      },
    }),
    db.opportunityMatch.findMany({
      where: { orgId, trackingStatus: "SAVED" },
      orderBy: { relevanceScore: "desc" },
      take: 10,
      select: {
        id: true,
        relevanceScore: true,
        opportunity: { select: { titleEn: true, buyerName: true, closingDate: true } },
      },
    }),
  ]);

  const toCard = (t: (typeof tenders)[number]): PipelineCard => ({
    id: t.id,
    titleEn: t.titleEn,
    titleAr: t.titleAr,
    clientName: t.clientName,
    status: t.status,
    sector: t.sector,
    submissionDeadline: t.submissionDeadline?.toISOString() ?? null,
    estimatedValue: t.estimatedValue != null ? Number(t.estimatedValue.toString()) : null,
    currency: t.currency ?? "USD",
    proposals: t._count.proposals,
    requirements: t._count.requirements,
    bid: t.bidDecision
      ? {
          score: t.bidDecision.score,
          recommendation: t.bidDecision.recommendation,
          humanDecision: t.bidDecision.humanDecision as "BID" | "NO_BID" | null,
        }
      : null,
  });

  const byStatus = (statuses: string[]) =>
    tenders.filter((t) => statuses.includes(t.status)).map(toCard);

  const live = tenders.filter((t) => ["ACTIVE", "SUBMITTED"].includes(t.status));
  const activeValue = live.reduce(
    (s, t) => s + (t.estimatedValue != null ? Number(t.estimatedValue.toString()) : 0),
    0
  );
  const currency = tenders.find((t) => t.currency)?.currency ?? "USD";

  return {
    discovered: savedMatches.map((m) => ({
      matchId: m.id,
      titleEn: m.opportunity.titleEn,
      buyerName: m.opportunity.buyerName,
      closingDate: m.opportunity.closingDate?.toISOString() ?? null,
      relevanceScore: m.relevanceScore,
    })),
    qualifying: byStatus(["DRAFT"]),
    bidding: byStatus(["ACTIVE"]),
    submitted: byStatus(["SUBMITTED"]),
    closed: byStatus(["WON", "LOST", "NO_DECISION", "CANCELLED"]),
    totals: { count: tenders.length, activeValue, currency },
  };
}
