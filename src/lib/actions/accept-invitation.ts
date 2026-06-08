"use server";

import { db } from "@/lib/prisma";
import type { MemberRole } from "@prisma/client";

/**
 * Accept a workspace invitation (cloud / Clerk edition).
 *
 * The invitee must be signed in with the SAME email the invite was issued to.
 * On success the user is added to the Clerk organization at the mapped role, a
 * Member row is ensured, and the invitation is marked ACCEPTED. The caller then
 * sets the org active (client-side) and lands on /dashboard.
 *
 * Air-gapped (OIDC) note: membership there is provisioned by the IdP, so this
 * mutation is Clerk-only by design — the accept page guards OIDC separately.
 */

type AcceptResult =
  | { success: true; clerkOrgId: string }
  | { success: false; error: string; code?: "AUTH_REQUIRED" | "EMAIL_MISMATCH" };

/** Clerk uses two built-in roles; custom roles fall back to org:member. */
function toClerkRole(role: MemberRole): string {
  switch (role) {
    case "OWNER":
    case "ADMIN":
      return "org:admin";
    default:
      return "org:member";
  }
}

export async function acceptInvitation(token: string): Promise<AcceptResult> {
  try {
    const { auth, currentUser, clerkClient } = await import("@clerk/nextjs/server");
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Please sign in to accept.", code: "AUTH_REQUIRED" };
    }

    const invitation = await db.invitation.findUnique({
      where: { token },
      include: { organization: true },
    });

    if (!invitation || invitation.status !== "PENDING") {
      return { success: false, error: "This invitation is no longer valid." };
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      await db.invitation.update({ where: { id: invitation.id }, data: { status: "EXPIRED" } });
      return { success: false, error: "This invitation has expired." };
    }

    const user = await currentUser();
    const userEmails = (user?.emailAddresses ?? []).map((e) => e.emailAddress.toLowerCase());
    if (!userEmails.includes(invitation.email.toLowerCase())) {
      return {
        success: false,
        code: "EMAIL_MISMATCH",
        error: `This invitation was sent to ${invitation.email}. Sign in with that email to accept.`,
      };
    }

    const org = invitation.organization;
    const client = await clerkClient();

    // Add to the Clerk organization (idempotent — ignore "already a member").
    try {
      await client.organizations.createOrganizationMembership({
        organizationId: org.clerkOrgId,
        userId,
        role: toClerkRole(invitation.role),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/already a member|already exists/i.test(msg)) {
        // A custom role may not exist in Clerk — retry as a basic member.
        try {
          await client.organizations.createOrganizationMembership({
            organizationId: org.clerkOrgId,
            userId,
            role: "org:member",
          });
        } catch (e2) {
          const msg2 = e2 instanceof Error ? e2.message : String(e2);
          if (!/already a member|already exists/i.test(msg2)) {
            console.error("clerk membership error:", msg2);
            return { success: false, error: "Could not join the workspace. Contact the inviter." };
          }
        }
      }
    }

    // Ensure a Member row in our DB (mirror getAuthContext's shape).
    const name =
      [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
      invitation.email;

    const member = await db.member.upsert({
      where: { orgId_clerkUserId: { orgId: org.id, clerkUserId: userId } },
      create: {
        clerkUserId: userId,
        orgId: org.id,
        email: invitation.email,
        name,
        avatarUrl: user?.imageUrl ?? null,
        role: invitation.role,
      },
      update: { isActive: true, deletedAt: null, role: invitation.role },
    });

    await db.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedById: member.id },
    });

    return { success: true, clerkOrgId: org.clerkOrgId };
  } catch (err) {
    console.error("acceptInvitation error:", err);
    return { success: false, error: "Could not accept the invitation." };
  }
}
