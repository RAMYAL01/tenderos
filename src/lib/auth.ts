import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/prisma";
import type { Organization, Member } from "@prisma/client";

export interface AuthContext {
  clerkUserId: string;
  clerkOrgId: string;
  org: Organization;
  member: Member;
}

/**
 * Server-side auth context helper.
 *
 * Fetches the current user's Organization and Member record from our DB,
 * using the Clerk userId + orgId from the session.
 *
 * - Cached per request via React cache() to avoid duplicate DB queries
 *   when called in multiple server components in the same render.
 * - Redirects to /sign-in if not authenticated or no org selected.
 * - Auto-creates org/member in DB if webhook hasn't fired yet (race condition).
 */
export const getAuthContext = cache(async (): Promise<AuthContext> => {
  const { userId: clerkUserId, orgId: clerkOrgId } = await auth();

  if (!clerkUserId) {
    redirect("/sign-in");
  }

  if (!clerkOrgId) {
    // Authenticated but no org selected — Clerk will handle org creation/selection
    redirect("/sign-in");
  }

  // Look up our DB org record
  let org = await db.organization.findUnique({
    where: { clerkOrgId },
  });

  // Handle webhook race condition: org might not be in DB yet
  if (!org) {
    // Org not in DB yet — fetch from Clerk's organizations API
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();
    let clerkOrg: { name: string; slug: string | null; imageUrl: string } | null = null;
    try {
      const fetchedOrg = await client.organizations.getOrganization({ organizationId: clerkOrgId });
      clerkOrg = { name: fetchedOrg.name, slug: fetchedOrg.slug, imageUrl: fetchedOrg.imageUrl };
    } catch {
      redirect("/sign-in");
    }

    if (!clerkOrg) redirect("/sign-in");

    org = await db.organization.create({
      data: {
        clerkOrgId,
        name: clerkOrg.name,
        slug: clerkOrg.slug ?? clerkOrgId,
        logoUrl: clerkOrg.imageUrl ?? null,
      },
    });
  }

  if (!org.isActive || org.deletedAt) {
    redirect("/sign-in");
  }

  // Look up our DB member record
  let member = await db.member.findFirst({
    where: {
      clerkUserId,
      orgId: org.id,
      isActive: true,
      deletedAt: null,
    },
  });

  // Handle webhook race condition: member might not be in DB yet
  if (!member) {
    const { currentUser } = await import("@clerk/nextjs/server");
    const clerkUser = await currentUser();

    if (!clerkUser) redirect("/sign-in");

    const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
    const name =
      [clerkUser.firstName, clerkUser.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      email ||
      "Unknown";

    // Check if this is the org creator (first member = owner)
    const existingMemberCount = await db.member.count({
      where: { orgId: org.id },
    });

    member = await db.member.create({
      data: {
        clerkUserId,
        orgId: org.id,
        email,
        name,
        avatarUrl: clerkUser.imageUrl ?? null,
        role: existingMemberCount === 0 ? "OWNER" : "WRITER",
      },
    });
  }

  return { clerkUserId, clerkOrgId, org, member };
});

/**
 * Check if the current member has a required role or higher.
 * Role hierarchy: OWNER > ADMIN > MANAGER > SENIOR_WRITER > WRITER > REVIEWER > VIEWER
 */
const ROLE_HIERARCHY = [
  "VIEWER",
  "REVIEWER",
  "WRITER",
  "SENIOR_WRITER",
  "MANAGER",
  "ADMIN",
  "OWNER",
] as const;

export function hasRole(
  memberRole: string,
  requiredRole: (typeof ROLE_HIERARCHY)[number]
): boolean {
  const memberIdx = ROLE_HIERARCHY.indexOf(memberRole as typeof ROLE_HIERARCHY[number]);
  const requiredIdx = ROLE_HIERARCHY.indexOf(requiredRole);
  return memberIdx >= requiredIdx;
}

export function requireRole(
  memberRole: string,
  requiredRole: (typeof ROLE_HIERARCHY)[number]
): void {
  if (!hasRole(memberRole, requiredRole)) {
    throw new Error(`Requires ${requiredRole} role or higher`);
  }
}
