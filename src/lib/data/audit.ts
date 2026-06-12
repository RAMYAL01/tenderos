import { db } from "@/lib/prisma";

/**
 * Audit-log read model (pure read, org-scoped, ADMIN-gated at the page/route).
 * Backed by @@index([orgId, createdAt]).
 */

export interface AuditRow {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  actorName: string | null;
  newValues: unknown;
  oldValues: unknown;
  createdAt: string; // ISO
}

export interface AuditQuery {
  orgId: string;
  /** Filter by action prefix, e.g. "member." or exact "tender.outcome_recorded". */
  action?: string;
  days?: number; // lookback window
  page?: number; // 1-based
  pageSize?: number;
}

export interface AuditPage {
  rows: AuditRow[];
  page: number;
  hasMore: boolean;
  total: number;
  /** Distinct action values present for this org (drives the filter select). */
  actions: string[];
}

export async function getAuditPage(q: AuditQuery): Promise<AuditPage> {
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, q.pageSize ?? 50));
  const since = q.days ? new Date(Date.now() - q.days * 86_400_000) : undefined;

  const where = {
    orgId: q.orgId,
    ...(q.action ? { action: { startsWith: q.action } } : {}),
    ...(since ? { createdAt: { gte: since } } : {}),
  };

  const [rows, total, actionRows] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize + 1, // +1 → hasMore without a second count
      select: {
        id: true,
        action: true,
        resourceType: true,
        resourceId: true,
        memberId: true,
        newValues: true,
        oldValues: true,
        createdAt: true,
      },
    }),
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where: { orgId: q.orgId },
      distinct: ["action"],
      select: { action: true },
      take: 50,
    }),
  ]);

  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;

  // Resolve actor names org-scoped in one query.
  const memberIds = [...new Set(pageRows.map((r) => r.memberId).filter((v): v is string => !!v))];
  const members = memberIds.length
    ? await db.member.findMany({
        where: { id: { in: memberIds }, orgId: q.orgId },
        select: { id: true, name: true },
      })
    : [];
  const nameOf = new Map(members.map((m) => [m.id, m.name]));

  return {
    rows: pageRows.map((r) => ({
      id: r.id,
      action: r.action,
      resourceType: r.resourceType,
      resourceId: r.resourceId,
      actorName: r.memberId ? nameOf.get(r.memberId) ?? "Unknown" : "System",
      newValues: r.newValues,
      oldValues: r.oldValues,
      createdAt: r.createdAt.toISOString(),
    })),
    page,
    hasMore,
    total,
    actions: actionRows.map((a) => a.action).sort(),
  };
}
