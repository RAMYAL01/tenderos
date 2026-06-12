import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/prisma";

export interface NotificationItem {
  id: string;
  type: "deadline" | "review" | "failed" | "discovery" | "outcome";
  title: string;
  description: string;
  href: string;
  tone: "amber" | "red" | "blue" | "emerald" | "violet";
  at: string; // ISO
}

/**
 * GET /api/notifications
 * Derives actionable notifications from live data — no separate notifications
 * table needed. Surfaces approaching deadlines and documents that need
 * attention (held for review or failed processing).
 */
export async function GET() {
  const { org } = await getAuthContext();

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [deadlines, attentionDocs, discoveryAlerts, outcomeDue] = await Promise.all([
    db.tender.findMany({
      where: {
        orgId: org.id,
        deletedAt: null,
        status: { in: ["DRAFT", "ACTIVE"] },
        submissionDeadline: { gte: now, lte: in7Days },
      },
      orderBy: { submissionDeadline: "asc" },
      take: 6,
      select: { id: true, titleEn: true, submissionDeadline: true },
    }),
    db.document.findMany({
      where: {
        orgId: org.id,
        deletedAt: null,
        processingStatus: { in: ["NEEDS_REVIEW", "FAILED"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: {
        id: true,
        originalFilename: true,
        processingStatus: true,
        tenderId: true,
        updatedAt: true,
      },
    }),
    // Unread discovery digests (created by the daily refresh cron).
    db.opportunityAlert.findMany({
      where: { orgId: org.id, channel: "IN_APP", status: "SENT", readAt: null },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, matchCount: true, createdAt: true },
    }),
    // Outcome debriefs overdue: submitted, deadline 7+ days past, no debrief yet.
    db.tender.findMany({
      where: {
        orgId: org.id,
        deletedAt: null,
        status: "SUBMITTED",
        outcomeRecordedAt: null,
        submissionDeadline: { lt: new Date(now.getTime() - 7 * 86_400_000) },
      },
      orderBy: { submissionDeadline: "asc" },
      take: 4,
      select: { id: true, titleEn: true, submissionDeadline: true },
    }),
  ]);

  const items: NotificationItem[] = [];

  for (const t of deadlines) {
    const days = Math.ceil((t.submissionDeadline!.getTime() - now.getTime()) / 86_400_000);
    items.push({
      id: `deadline-${t.id}`,
      type: "deadline",
      title: days <= 1 ? "Deadline due soon" : `Deadline in ${days} days`,
      description: t.titleEn,
      href: `/tenders/${t.id}`,
      tone: "amber",
      at: t.submissionDeadline!.toISOString(),
    });
  }

  for (const d of attentionDocs) {
    const failed = d.processingStatus === "FAILED";
    items.push({
      id: `doc-${d.id}`,
      type: failed ? "failed" : "review",
      title: failed ? "Document processing failed" : "Document needs review",
      description: d.originalFilename,
      href: `/tenders/${d.tenderId}`,
      tone: failed ? "red" : "blue",
      at: d.updatedAt.toISOString(),
    });
  }

  for (const a of discoveryAlerts) {
    items.push({
      id: `discovery-${a.id}`,
      type: "discovery",
      title: `${a.matchCount} new matched ${a.matchCount === 1 ? "opportunity" : "opportunities"}`,
      description: "Fresh tenders ranked for your company in Discover.",
      href: "/discover",
      tone: "emerald",
      at: a.createdAt.toISOString(),
    });
  }

  for (const t of outcomeDue) {
    items.push({
      id: `outcome-${t.id}`,
      type: "outcome",
      title: "Did you win this bid?",
      description: `${t.titleEn} — record the outcome to sharpen your scoring.`,
      href: `/tenders/${t.id}`,
      tone: "violet",
      at: t.submissionDeadline!.toISOString(),
    });
  }

  // Newest / most urgent first
  items.sort((a, b) => (a.at < b.at ? 1 : -1));

  return NextResponse.json({ items, count: items.length });
}
