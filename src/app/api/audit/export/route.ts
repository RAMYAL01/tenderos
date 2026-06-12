import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/audit/export?days=90&action=member.
 * ADMIN+ CSV export of the org's audit trail (procurement/security reviews ask
 * for exactly this). Org-scoped; capped at 5,000 rows per export.
 */
export async function GET(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await db.member.findFirst({
    where: { clerkUserId: userId, orgId: org.id, isActive: true, deletedAt: null },
  });
  if (!member || !hasRole(member.role, "ADMIN")) {
    return NextResponse.json({ error: "Requires Admin role" }, { status: 403 });
  }

  const url = new URL(req.url);
  const days = Math.max(1, Math.min(365, parseInt(url.searchParams.get("days") ?? "90", 10) || 90));
  const action = url.searchParams.get("action") || undefined;
  const since = new Date(Date.now() - days * 86_400_000);

  const rows = await db.auditLog.findMany({
    where: {
      orgId: org.id,
      createdAt: { gte: since },
      ...(action ? { action: { startsWith: action } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: {
      id: true,
      action: true,
      resourceType: true,
      resourceId: true,
      memberId: true,
      oldValues: true,
      newValues: true,
      createdAt: true,
    },
  });

  const memberIds = [...new Set(rows.map((r) => r.memberId).filter((v): v is string => !!v))];
  const members = memberIds.length
    ? await db.member.findMany({
        where: { id: { in: memberIds }, orgId: org.id },
        select: { id: true, name: true, email: true },
      })
    : [];
  const byId = new Map(members.map((m) => [m.id, m]));

  const esc = (v: unknown): string => {
    const s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
    return `"${s.replace(/"/g, '""')}"`;
  };

  const header = ["timestamp", "actor_name", "actor_email", "action", "resource_type", "resource_id", "old_values", "new_values"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const actor = r.memberId ? byId.get(r.memberId) : null;
    lines.push(
      [
        esc(r.createdAt.toISOString()),
        esc(actor?.name ?? "System"),
        esc(actor?.email ?? ""),
        esc(r.action),
        esc(r.resourceType ?? ""),
        esc(r.resourceId ?? ""),
        esc(r.oldValues ?? ""),
        esc(r.newValues ?? ""),
      ].join(",")
    );
  }

  const filename = `tenderos-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
