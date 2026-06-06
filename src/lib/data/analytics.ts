import { db } from "@/lib/prisma";
import { PLAN_LIMITS } from "@/lib/constants";
import type { PlanTier } from "@prisma/client";
import { startOfMonth, subMonths, format } from "date-fns";

/**
 * Analytics data layer. One tenders query + a few aggregates, all org-scoped.
 * Everything returned is plain/serializable (Decimals → numbers).
 */

export interface NameCount {
  label: string;
  count: number;
}

export interface AnalyticsData {
  hasData: boolean;
  totals: {
    total: number;
    active: number;
    submitted: number;
    won: number;
    lost: number;
    noDecision: number;
    draft: number;
    cancelled: number;
    decided: number;
    winRate: number; // 0..100, won / (won+lost)
  };
  pipeline: { activeValue: number; wonValue: number; currency: string };
  statusBreakdown: NameCount[];
  proposals: { total: number; byStatus: NameCount[]; avgCompliance: number | null };
  ai: {
    totalJobs: number;
    totalTokens: number;
    totalCostUsd: number;
    creditsUsed: number;
    creditsLimit: number;
  };
  team: Array<{ name: string; tenders: number; proposals: number }>;
  language: NameCount[];
  monthly: Array<{ month: string; created: number; won: number }>;
}

const LANG_LABELS: Record<string, string> = {
  EN: "English",
  AR: "Arabic",
  AR_SA: "Arabic (SA)",
  AR_AE: "Arabic (AE)",
  AR_EG: "Arabic (EG)",
  BILINGUAL: "Bilingual",
};

export async function getAnalytics(orgId: string): Promise<AnalyticsData> {
  const monthsWindowStart = startOfMonth(subMonths(new Date(), 5));

  const [tenders, proposalsByStatus, proposalAgg, proposalsByMember, aiAgg, members, subscription] =
    await Promise.all([
      db.tender.findMany({
        where: { orgId, deletedAt: null },
        select: {
          status: true,
          estimatedValue: true,
          currency: true,
          primaryLanguage: true,
          createdAt: true,
          updatedAt: true,
          createdById: true,
        },
      }),
      db.proposal.groupBy({
        by: ["status"],
        where: { orgId, deletedAt: null },
        _count: { _all: true },
      }),
      db.proposal.aggregate({
        where: { orgId, deletedAt: null },
        _avg: { complianceScore: true },
        _count: { _all: true },
      }),
      db.proposal.groupBy({
        by: ["createdById"],
        where: { orgId, deletedAt: null },
        _count: { _all: true },
      }),
      db.aIJob.aggregate({
        where: { orgId },
        _sum: { totalTokens: true, costUsd: true },
        _count: { _all: true },
      }),
      db.member.findMany({
        where: { orgId, deletedAt: null },
        select: { id: true, name: true },
      }),
      db.subscription.findUnique({ where: { orgId } }),
    ]);

  // ── Status counts ──
  const statusCount = (s: string) => tenders.filter((t) => t.status === s).length;
  const won = statusCount("WON");
  const lost = statusCount("LOST");
  const decided = won + lost;
  const winRate = decided > 0 ? Math.round((won / decided) * 1000) / 10 : 0;

  const STATUS_ORDER = ["DRAFT", "ACTIVE", "SUBMITTED", "WON", "LOST", "NO_DECISION", "CANCELLED"];
  const statusBreakdown: NameCount[] = STATUS_ORDER.map((s) => ({
    label: titleCase(s),
    count: statusCount(s),
  })).filter((x) => x.count > 0);

  // ── Pipeline value ──
  const num = (d: unknown) => (d == null ? 0 : Number(d));
  const activeValue = tenders
    .filter((t) => t.status === "ACTIVE" || t.status === "SUBMITTED")
    .reduce((s, t) => s + num(t.estimatedValue), 0);
  const wonValue = tenders
    .filter((t) => t.status === "WON")
    .reduce((s, t) => s + num(t.estimatedValue), 0);
  const currency = dominant(tenders.map((t) => t.currency ?? "USD")) ?? "USD";

  // ── Language split ──
  const langMap = new Map<string, number>();
  for (const t of tenders) {
    const key = t.primaryLanguage ?? "EN";
    langMap.set(key, (langMap.get(key) ?? 0) + 1);
  }
  const language: NameCount[] = [...langMap.entries()]
    .map(([k, count]) => ({ label: LANG_LABELS[k] ?? k, count }))
    .sort((a, b) => b.count - a.count);

  // ── Monthly trend (last 6 months) ──
  const monthly = buildMonthlyBuckets(monthsWindowStart);
  for (const t of tenders) {
    const cKey = monthKey(t.createdAt);
    const cBucket = monthly.find((m) => m.key === cKey);
    if (cBucket) cBucket.created += 1;
    if (t.status === "WON") {
      const wKey = monthKey(t.updatedAt);
      const wBucket = monthly.find((m) => m.key === wKey);
      if (wBucket) wBucket.won += 1;
    }
  }

  // ── Team activity ──
  const nameOf = new Map(members.map((m) => [m.id, m.name]));
  const teamMap = new Map<string, { name: string; tenders: number; proposals: number }>();
  const ensure = (id: string) => {
    if (!teamMap.has(id))
      teamMap.set(id, { name: nameOf.get(id) ?? "Unknown", tenders: 0, proposals: 0 });
    return teamMap.get(id)!;
  };
  for (const t of tenders) ensure(t.createdById).tenders += 1;
  for (const p of proposalsByMember) ensure(p.createdById).proposals += (p._count?._all ?? 0);
  const team = [...teamMap.values()].sort(
    (a, b) => b.tenders + b.proposals - (a.tenders + a.proposals)
  );

  // ── Proposals ──
  const proposalsByStatusOut: NameCount[] = proposalsByStatus
    .map((p) => ({ label: titleCase(p.status), count: p._count?._all ?? 0 }))
    .sort((a, b) => b.count - a.count);

  // ── AI usage ──
  const plan: PlanTier = subscription?.planTier ?? "STARTER";
  const creditsLimit = PLAN_LIMITS[plan].aiCreditsPerMonth;

  return {
    hasData: tenders.length > 0 || (proposalAgg._count?._all ?? 0) > 0,
    totals: {
      total: tenders.length,
      active: statusCount("ACTIVE"),
      submitted: statusCount("SUBMITTED"),
      won,
      lost,
      noDecision: statusCount("NO_DECISION"),
      draft: statusCount("DRAFT"),
      cancelled: statusCount("CANCELLED"),
      decided,
      winRate,
    },
    pipeline: { activeValue, wonValue, currency },
    statusBreakdown,
    proposals: {
      total: proposalAgg._count?._all ?? 0,
      byStatus: proposalsByStatusOut,
      avgCompliance:
        proposalAgg._avg.complianceScore != null
          ? Math.round(proposalAgg._avg.complianceScore)
          : null,
    },
    ai: {
      totalJobs: aiAgg._count?._all ?? 0,
      totalTokens: aiAgg._sum.totalTokens ?? 0,
      totalCostUsd: Math.round(num(aiAgg._sum.costUsd) * 100) / 100,
      creditsUsed: subscription?.aiCreditsUsed ?? 0,
      creditsLimit,
    },
    team,
    language,
    monthly: monthly.map((m) => ({ month: m.month, created: m.created, won: m.won })),
  };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function dominant(arr: string[]): string | null {
  if (!arr.length) return null;
  const counts = new Map<string, number>();
  for (const a of arr) counts.set(a, (counts.get(a) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function monthKey(d: Date): string {
  return format(d, "yyyy-MM");
}

function buildMonthlyBuckets(start: Date) {
  const buckets: Array<{ key: string; month: string; created: number; won: number }> = [];
  for (let i = 0; i < 6; i++) {
    const d = startOfMonth(subMonths(new Date(), 5 - i));
    buckets.push({ key: format(d, "yyyy-MM"), month: format(d, "MMM"), created: 0, won: 0 });
  }
  return buckets;
}
