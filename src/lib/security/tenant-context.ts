/**
 * Tenant context — the single source of "who is asking".
 *
 * In TenderOS the TENANT is the Organization; `orgId` is the tenant_id on every
 * scoped table. The context also carries the acting member/user for the audit
 * trail. It is resolved ONCE per request from the verified Clerk session and
 * then threaded into the tenant-bound Prisma client — never trusted from the
 * request body.
 */

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

export interface TenantContext {
  /** tenant_id — the internal Organization.id. */
  orgId: string;
  /** Acting Member.id (internal actor) — for the audit trail. */
  memberId?: string;
  /** Acting Clerk user id (external actor) — stored opaquely in audit metadata. */
  userId?: string;
}

export class TenantSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantSecurityError";
  }
}

/**
 * Resolve the tenant context from the trusted server session.
 * Throws (fail-closed) if there is no authenticated tenant — there is no code
 * path that yields a Prisma client without a tenant id.
 */
export async function requireTenantContext(): Promise<TenantContext> {
  const { userId, orgId: clerkOrgId } = await auth();
  if (!userId || !clerkOrgId) {
    throw new TenantSecurityError("No authenticated tenant context.");
  }

  const org = await db.organization.findUnique({
    where: { clerkOrgId },
    select: { id: true, isActive: true, deletedAt: true },
  });
  if (!org || !org.isActive || org.deletedAt) {
    throw new TenantSecurityError("Tenant is not provisioned or is inactive.");
  }

  const member = await db.member.findFirst({
    where: { clerkUserId: userId, orgId: org.id, isActive: true, deletedAt: null },
    select: { id: true },
  });

  return { orgId: org.id, memberId: member?.id, userId };
}
