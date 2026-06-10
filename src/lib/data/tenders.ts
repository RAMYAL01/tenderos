import { db } from "@/lib/prisma";

export interface TenderListItem {
  id: string;
  titleEn: string;
  titleAr: string | null;
  referenceNo: string | null;
  clientName: string | null;
  status: string;
  sector: string | null;
  primaryLanguage: string;
  submissionDeadline: Date | null;
  estimatedValue: number | null;
  currency: string;
  createdAt: Date;
  counts: { documents: number; requirements: number; proposals: number };
}

/**
 * Non-deleted tenders for an org, newest first, with related counts.
 * Capped at 500 rows as a response-size guard; move to cursor pagination
 * when any tenant approaches the cap.
 */
export async function getAllTenders(orgId: string): Promise<TenderListItem[]> {
  const rows = await db.tender.findMany({
    where: { orgId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 500,
    select: {
      id: true,
      titleEn: true,
      titleAr: true,
      referenceNo: true,
      clientName: true,
      status: true,
      sector: true,
      primaryLanguage: true,
      submissionDeadline: true,
      estimatedValue: true,
      currency: true,
      createdAt: true,
      _count: { select: { documents: true, requirements: true, proposals: true } },
    },
  });

  return rows.map((t) => ({
    id: t.id,
    titleEn: t.titleEn,
    titleAr: t.titleAr,
    referenceNo: t.referenceNo,
    clientName: t.clientName,
    status: t.status,
    sector: t.sector,
    primaryLanguage: t.primaryLanguage,
    submissionDeadline: t.submissionDeadline,
    estimatedValue: t.estimatedValue != null ? Number(t.estimatedValue) : null,
    currency: t.currency ?? "USD",
    createdAt: t.createdAt,
    counts: t._count,
  }));
}
