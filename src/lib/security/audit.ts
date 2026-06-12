import { db } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Security audit trail — explicit, curated logging.
 *
 * Rather than auditing every row write (the Prisma-extension approach is noisy:
 * match upserts, cron sweeps, AI job progress…), we log the SECURITY-SIGNIFICANT
 * events an enterprise security review actually asks about: who changed roles,
 * who invited whom, who approved what, who deleted what, who recorded outcomes.
 *
 * Append-only by convention (application code never updates/deletes audit rows).
 * Never throws — an audit failure must never break the business mutation.
 */

export interface AuditEvent {
  orgId: string;
  memberId?: string | null;
  /** dot-namespaced, e.g. "member.role_changed", "invitation.created" */
  action: string;
  resourceType?: string;
  resourceId?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
  metadata?: Record<string, unknown>;
}

function toJson(v: unknown): Prisma.InputJsonValue | undefined {
  if (v == null) return undefined;
  try {
    return JSON.parse(
      JSON.stringify(v, (k, val) => (k.toLowerCase().includes("password") ? "[redacted]" : val))
    ) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

export async function logAudit(event: AuditEvent): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        orgId: event.orgId,
        memberId: event.memberId ?? null,
        action: event.action,
        resourceType: event.resourceType ?? null,
        resourceId: event.resourceId ?? null,
        oldValues: toJson(event.oldValues),
        newValues: toJson(event.newValues),
        metadata: toJson(event.metadata) ?? {},
      },
    });
  } catch (e) {
    console.error("[audit] write failed:", e instanceof Error ? e.message : e);
  }
}
