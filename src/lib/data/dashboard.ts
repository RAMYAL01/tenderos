import { db } from "@/lib/prisma";
import { startOfMonth } from "date-fns";

/**
 * All dashboard data fetching functions.
 * These run server-side and are called from the dashboard page.
 */

export interface DashboardStats {
  activeTenders: number;
  totalTenders: number;
  avgComplianceScore: number | null;
  proposalsThisMonth: number;
  aiCreditsUsed: number;
  aiCreditsLimit: number;
  teamMembers: number;
  documentsProcessed: number;
}

export async function getDashboardStats(orgId: string): Promise<DashboardStats> {
  const now = new Date();
  const monthStart = startOfMonth(now);

  const [
    activeTenders,
    totalTenders,
    proposalsThisMonth,
    aiCreditsUsed,
    teamMembers,
    documentsProcessed,
    complianceAgg,
    subscription,
  ] = await Promise.all([
    db.tender.count({
      where: { orgId, status: "ACTIVE", deletedAt: null },
    }),
    db.tender.count({
      where: { orgId, deletedAt: null },
    }),
    db.proposal.count({
      where: {
        orgId,
        createdAt: { gte: monthStart },
        deletedAt: null,
      },
    }),
    // Sum AI credits used this month
    db.aIJob.aggregate({
      where: {
        orgId,
        createdAt: { gte: monthStart },
        status: "COMPLETED",
      },
      _count: { id: true },
    }),
    db.member.count({
      where: { orgId, isActive: true, deletedAt: null },
    }),
    db.document.count({
      where: {
        orgId,
        processingStatus: "READY",
        deletedAt: null,
      },
    }),
    // Average compliance score across active tenders that have proposals
    db.proposal.aggregate({
      where: {
        orgId,
        complianceScore: { not: null },
        deletedAt: null,
        tender: { status: "ACTIVE" },
      },
      _avg: { complianceScore: true },
    }),
    db.subscription.findUnique({ where: { orgId } }),
  ]);

  return {
    activeTenders,
    totalTenders,
    avgComplianceScore: complianceAgg._avg.complianceScore ?? null,
    proposalsThisMonth,
    aiCreditsUsed: aiCreditsUsed._count.id,
    aiCreditsLimit: subscription?.seats
      ? subscription.seats * 50 // rough estimate
      : 50,
    teamMembers,
    documentsProcessed,
  };
}

export interface RecentTender {
  id: string;
  titleEn: string;
  titleAr: string | null;
  referenceNo: string | null;
  clientName: string | null;
  status: string;
  primaryLanguage: string;
  submissionDeadline: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  _count: {
    documents: number;
    requirements: number;
    proposals: number;
  };
}

export async function getRecentTenders(
  orgId: string,
  limit = 8
): Promise<RecentTender[]> {
  return db.tender.findMany({
    where: { orgId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      titleEn: true,
      titleAr: true,
      referenceNo: true,
      clientName: true,
      status: true,
      primaryLanguage: true,
      submissionDeadline: true,
      createdAt: true,
      updatedAt: true,
      createdBy: {
        select: { id: true, name: true, avatarUrl: true },
      },
      _count: {
        select: { documents: true, requirements: true, proposals: true },
      },
    },
  }) as Promise<RecentTender[]>;
}

export interface UpcomingDeadline {
  id: string;
  titleEn: string;
  titleAr: string | null;
  submissionDeadline: Date;
  status: string;
  clientName: string | null;
}

export async function getUpcomingDeadlines(
  orgId: string,
  limit = 5
): Promise<UpcomingDeadline[]> {
  return db.tender.findMany({
    where: {
      orgId,
      status: { in: ["DRAFT", "ACTIVE"] },
      submissionDeadline: { gte: new Date() },
      deletedAt: null,
    },
    orderBy: { submissionDeadline: "asc" },
    take: limit,
    select: {
      id: true,
      titleEn: true,
      titleAr: true,
      submissionDeadline: true,
      status: true,
      clientName: true,
    },
  }) as Promise<UpcomingDeadline[]>;
}
