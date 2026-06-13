import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";

/**
 * Market intelligence (Phase 7/8) — aggregate demand signals over the GLOBAL
 * Opportunity catalog. The catalog is shared public data, so these stats are
 * market-wide and identical for every tenant (no org scoping, nothing leaks).
 * PURE READ.
 */

export interface MarketIntel {
  activity: { open: number; closingSoon: number; newLast7d: number; countries: number; buyers: number };
  byCountry: { country: string; count: number }[];
  bySector: { sector: string; count: number }[];
  topBuyers: { buyer: string; count: number }[];
  expiring: {
    id: string;
    title: string;
    country: string | null;
    sector: string | null;
    closingDate: Date | null;
    summary: string | null;
  }[];
}

const OPEN: Prisma.OpportunityWhereInput = { status: { in: ["OPEN", "CLOSING_SOON"] } };

export async function getMarketIntelligence(): Promise<MarketIntel> {
  const since7d = new Date(Date.now() - 7 * 86_400_000);
  const in14d = new Date(Date.now() + 14 * 86_400_000);

  const [open, closingSoon, newLast7d, countryGroups, sectorGroups, buyerGroups, expiring] =
    await Promise.all([
      db.opportunity.count({ where: OPEN }),
      db.opportunity.count({ where: { status: "CLOSING_SOON" } }),
      db.opportunity.count({ where: { ...OPEN, createdAt: { gte: since7d } } }),
      db.opportunity.groupBy({
        by: ["country"],
        where: OPEN,
        _count: { _all: true },
        orderBy: { _count: { country: "desc" } },
      }),
      db.opportunity.groupBy({
        by: ["sector"],
        where: OPEN,
        _count: { _all: true },
        orderBy: { _count: { sector: "desc" } },
      }),
      db.opportunity.groupBy({
        by: ["buyerName"],
        where: OPEN,
        _count: { _all: true },
        orderBy: { _count: { buyerName: "desc" } },
      }),
      db.opportunity.findMany({
        where: { status: { in: ["OPEN", "CLOSING_SOON"] }, closingDate: { gte: new Date(), lte: in14d } },
        orderBy: { closingDate: "asc" },
        take: 8,
        select: { id: true, titleEn: true, country: true, sector: true, closingDate: true, summaryEn: true },
      }),
    ]);

  const byCountry = countryGroups
    .filter((g) => g.country)
    .map((g) => ({ country: g.country as string, count: g._count._all }));
  const bySector = sectorGroups
    .filter((g) => g.sector)
    .map((g) => ({ sector: g.sector as string, count: g._count._all }));
  const buyers = buyerGroups.filter((g) => g.buyerName);
  const topBuyers = buyers.slice(0, 10).map((g) => ({ buyer: g.buyerName as string, count: g._count._all }));

  return {
    activity: {
      open,
      closingSoon,
      newLast7d,
      countries: byCountry.length,
      buyers: buyers.length,
    },
    byCountry,
    bySector,
    topBuyers,
    expiring: expiring.map((e) => ({
      id: e.id,
      title: e.titleEn,
      country: e.country,
      sector: e.sector,
      closingDate: e.closingDate,
      summary: e.summaryEn,
    })),
  };
}
