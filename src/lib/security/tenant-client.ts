/**
 * The Tenant-Bound Prisma Client.
 *
 * Composes tenant isolation (Part 1) + audit logging (Part 3) onto the base
 * client. Every read/write through the returned client is confined to one
 * tenant and (for mutations) recorded in the audit trail.
 *
 * ── Safe usage in a Next.js Server Action / Route Handler ──
 *
 *   "use server";
 *   import { getTenantDb } from "@/lib/security/tenant-client";
 *
 *   export async function listMyTenders() {
 *     const tdb = await getTenantDb();            // resolves tenant from session
 *     return tdb.tender.findMany();               // no `where: { orgId }` needed
 *   }
 *
 *   // API route with guaranteed audit flush on serverless:
 *   import { after } from "next/server";
 *   export async function POST(req: Request) {
 *     const tdb = await getTenantDb({ audit: { mode: "background" } });
 *     const tender = await tdb.tender.create({ data: { titleEn: "..." } }); // orgId auto-injected
 *     after(async () => { await flushPendingAudits(); }); // background audit flush
 *     return Response.json(tender);
 *   }
 *
 * NEVER export a tenant-bound client at module scope or cache it across
 * requests — it is bound to one tenant. Always construct it per request from
 * the verified session.
 */

import { db } from "@/lib/prisma";
import { tenantIsolationExtension } from "./tenant-isolation";
import { auditExtension, type AuditOptions } from "./audit-extension";
import { requireTenantContext, TenantSecurityError, type TenantContext } from "./tenant-context";

export interface TenantClientOptions {
  audit?: AuditOptions | false; // pass `false` to disable audit (e.g. read-only background jobs)
}

/** Build a tenant-bound client from an EXPLICIT context (e.g. a trusted worker). */
export function tenantClientFor(ctx: TenantContext, opts: TenantClientOptions = {}) {
  if (!ctx?.orgId) {
    throw new TenantSecurityError("Refusing to build a Prisma client without a tenant id.");
  }
  let client = db.$extends(tenantIsolationExtension(ctx.orgId));
  if (opts.audit !== false) {
    client = client.$extends(auditExtension(ctx, opts.audit ?? {}));
  }
  return client;
}

export type TenantPrisma = ReturnType<typeof tenantClientFor>;

/**
 * Resolve the tenant from the verified Clerk session and return a tenant-bound
 * client. This is the ONLY function app code should use in Server
 * Actions/Routes — it fails closed if there is no authenticated tenant.
 */
export async function getTenantDb(opts: TenantClientOptions = {}): Promise<TenantPrisma> {
  const ctx = await requireTenantContext();
  return tenantClientFor(ctx, opts);
}
