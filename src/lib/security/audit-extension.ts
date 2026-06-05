/**
 * Part 3 — Enterprise Audit Logging (Prisma Client Extension).
 *
 * Intercepts every mutation (create/createMany/update/updateMany/delete/
 * deleteMany/upsert) on tenant data and writes an immutable record to the
 * `audit_logs` table: who (userId/memberId), which tenant (orgId), which model,
 * what action, and when.
 *
 * Two safety properties:
 *   1. NO RECURSION — the audit row is written with the BASE prisma client
 *      (`db`), never the extended one, so the audit insert is not itself
 *      intercepted/audited.
 *   2. RESPONSE TIME — `mode: "background"` fires the insert without blocking
 *      the mutation's return. On Vercel serverless, wrap the route/action in
 *      `after()` so the background write is flushed (see usage docs). Default is
 *      "blocking" (a single fast INSERT) for guaranteed delivery.
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import type { TenantContext } from "./tenant-context";

const MUTATIONS = new Set([
  "create",
  "createMany",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "upsert",
]);

export interface AuditOptions {
  /** "blocking" awaits the audit insert (reliable). "background" fire-and-forget. */
  mode?: "blocking" | "background";
  /** Models to never audit (in addition to AuditLog, which is always excluded). */
  exclude?: ReadonlySet<string>;
}

export function auditExtension(ctx: TenantContext, opts: AuditOptions = {}) {
  const mode = opts.mode ?? "blocking";
  const exclude = opts.exclude ?? new Set<string>();

  return Prisma.defineExtension({
    name: "audit-log",
    query: {
      $allModels: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async $allOperations({ model, operation, args, query }: any) {
          const result = await query(args);

          const shouldAudit = model !== "AuditLog" && !exclude.has(model) && MUTATIONS.has(operation);
          if (shouldAudit) {
            const write = writeAuditEntry(ctx, model, operation, args, result).catch((e) => {
              // Never let audit failure break the business mutation.
              console.error("[audit] write failed:", e instanceof Error ? e.message : e);
            });
            if (mode === "blocking") await write;
          }
          return result;
        },
      },
    },
  });
}

async function writeAuditEntry(
  ctx: TenantContext,
  model: string,
  operation: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any
): Promise<void> {
  const resourceType = lowerFirst(model);
  await db.auditLog.create({
    data: {
      orgId: ctx.orgId,
      memberId: ctx.memberId ?? null,
      action: `${resourceType}.${operation}`,
      resourceType,
      resourceId: extractResourceId(args, result),
      // store a sanitized "after" snapshot for single-record writes only
      newValues: sanitizeValues(operation, args),
      metadata: {
        userId: ctx.userId ?? null,
        affected: extractCount(operation, result),
        at: new Date().toISOString(),
      },
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractResourceId(args: any, result: any): string | null {
  if (result && typeof result === "object" && typeof result.id === "string") return result.id;
  const whereId = args?.where?.id;
  return typeof whereId === "string" ? whereId : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractCount(operation: string, result: any): number {
  if (result && typeof result === "object" && typeof result.count === "number") return result.count;
  return operation.endsWith("Many") ? 0 : 1;
}

/** Keep a compact, PII-light snapshot of what changed (single-record writes). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeValues(operation: string, args: any): Prisma.InputJsonValue | undefined {
  if (operation.endsWith("Many")) return undefined;
  const payload = args?.data ?? args?.create;
  if (!payload || typeof payload !== "object") return undefined;
  try {
    // round-trip drops functions/Dates-as-objects and yields a plain JSON value
    return JSON.parse(JSON.stringify(payload, (k, v) => (k.toLowerCase().includes("password") ? "[redacted]" : v)));
  } catch {
    return undefined;
  }
}

function lowerFirst(s: string): string {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}
