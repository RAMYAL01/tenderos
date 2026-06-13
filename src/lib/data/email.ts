import { db } from "@/lib/prisma";
import type { EmailStatus, EmailCategory, Prisma } from "@prisma/client";

/**
 * Email-activity read model for the workspace admin viewer. PURE READ, strictly
 * org-scoped — an admin only ever sees their own workspace's mail. Mirrors the
 * audit-log reader: window + status filter + pagination + a status summary.
 */

export interface EmailActivityRow {
  id: string;
  toEmail: string;
  subject: string;
  event: string;
  category: EmailCategory;
  status: EmailStatus;
  error: string | null;
  attempts: number;
  createdAt: Date;
  sentAt: Date | null;
}

export interface EmailActivityPage {
  rows: EmailActivityRow[];
  total: number;
  page: number;
  pageSize: number;
  statusCounts: Record<string, number>;
}

const PAGE_SIZE = 25;

export async function getEmailActivity(
  orgId: string,
  q: { status?: EmailStatus | null; days?: number; page?: number } = {}
): Promise<EmailActivityPage> {
  const days = q.days && q.days > 0 ? q.days : 30;
  const page = Math.max(1, q.page ?? 1);
  const since = new Date(Date.now() - days * 86_400_000);

  const windowWhere: Prisma.EmailLogWhereInput = { orgId, createdAt: { gte: since } };
  const where: Prisma.EmailLogWhereInput = {
    ...windowWhere,
    ...(q.status ? { status: q.status } : {}),
  };

  const [rows, total, grouped] = await Promise.all([
    db.emailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        toEmail: true,
        subject: true,
        event: true,
        category: true,
        status: true,
        error: true,
        attempts: true,
        createdAt: true,
        sentAt: true,
      },
    }),
    db.emailLog.count({ where }),
    db.emailLog.groupBy({ by: ["status"], where: windowWhere, _count: { _all: true } }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const g of grouped) statusCounts[g.status] = g._count._all;

  return { rows, total, page, pageSize: PAGE_SIZE, statusCounts };
}
