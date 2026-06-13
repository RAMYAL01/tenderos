"use server";

import { randomBytes } from "crypto";
import { after } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma";
import { getAuthContext, requireRole } from "@/lib/auth";
import { checkSeatLimit } from "@/lib/billing/quota";
import { hashInviteToken } from "@/lib/security/invite-token";
import { logAudit } from "@/lib/security/audit";
import { APP_URL } from "@/lib/constants";
import { notifyUserInvited } from "@/lib/email/events";
import { track, analyticsContext } from "@/lib/analytics/track";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import type { MemberRole, InvitationStatus } from "@prisma/client";

/**
 * App-native, link-based team invitations (org-first).
 *
 * Why link-based: it works identically in the cloud (Clerk) and air-gapped
 * (OIDC) editions with no external email dependency. An OWNER/ADMIN generates a
 * tokenized link scoped to THIS workspace + a role; the invitee opens it,
 * authenticates, and joins this org (never a new one). The Invitation row is the
 * audit trail (who invited whom, at what role, accepted/revoked/expired).
 *
 * Tenant safety: every action resolves orgId from the caller's auth context and
 * scopes all reads/writes to it. An invitation can only ever grant access to its
 * own org.
 */

const INVITE_TTL_DAYS = 7;

const ASSIGNABLE_ROLES: MemberRole[] = [
  "ADMIN",
  "MANAGER",
  "SENIOR_WRITER",
  "WRITER",
  "REVIEWER",
  "VIEWER",
];

const CreateSchema = z.object({
  email: z.string().email("Enter a valid email"),
  role: z.enum(["ADMIN", "MANAGER", "SENIOR_WRITER", "WRITER", "REVIEWER", "VIEWER"]),
});

export type InvitationDTO = {
  id: string;
  email: string;
  role: MemberRole;
  status: InvitationStatus;
  /**
   * "/invite/<rawToken>" — ONLY present on the createInvitation result (tokens
   * are stored hashed, so the link can't be reconstructed later; use
   * createInvitation again to mint a fresh link for the same email).
   */
  path: string | null;
  expiresAt: string;
  createdAt: string;
};

type CreateResult =
  | { success: true; invitation: InvitationDTO }
  | { success: false; error: string };

function toDTO(
  i: {
    id: string;
    email: string;
    role: MemberRole;
    status: InvitationStatus;
    expiresAt: Date;
    createdAt: Date;
  },
  rawToken?: string
): InvitationDTO {
  return {
    id: i.id,
    email: i.email,
    role: i.role,
    status: i.status,
    path: rawToken ? `/invite/${rawToken}` : null,
    expiresAt: i.expiresAt.toISOString(),
    createdAt: i.createdAt.toISOString(),
  };
}

/** Create (or refresh) a workspace invitation and return its shareable link. */
export async function createInvitation(input: {
  email: string;
  role: MemberRole;
}): Promise<CreateResult> {
  try {
    const { clerkUserId, org, member } = await getAuthContext();
    requireRole(member.role, "ADMIN");
    const analytics = analyticsContext({ clerkUserId, org, member });

    const parsed = CreateSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }
    const email = parsed.data.email.toLowerCase().trim();
    const role = parsed.data.role;

    // Only OWNER may mint another ADMIN.
    if (role === "ADMIN" && member.role !== "OWNER") {
      return { success: false, error: "Only the owner can invite admins." };
    }

    // Already an active member?
    const existing = await db.member.findFirst({
      where: { orgId: org.id, email, isActive: true, deletedAt: null },
    });
    if (existing) {
      return { success: false, error: "That person is already in your workspace." };
    }

    // Plan limit: seats (active members + pending invites).
    const seats = await checkSeatLimit(org.id);
    if (!seats.ok) {
      after(() => track(ANALYTICS_EVENTS.PLAN_LIMIT_REACHED, analytics, { limit_type: "seat" }));
      return { success: false, error: seats.error };
    }

    const rawToken = randomBytes(24).toString("base64url");
    const tokenHash = hashInviteToken(rawToken); // stored hashed — raw shown once
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);

    // One active invite per email per workspace — refresh in place.
    const invitation = await db.invitation.upsert({
      where: { orgId_email: { orgId: org.id, email } },
      create: {
        orgId: org.id,
        email,
        role,
        token: tokenHash,
        status: "PENDING",
        invitedById: member.id,
        expiresAt,
      },
      update: {
        role,
        token: tokenHash,
        status: "PENDING",
        invitedById: member.id,
        expiresAt,
        acceptedAt: null,
        acceptedById: null,
      },
    });

    await logAudit({
      orgId: org.id,
      memberId: member.id,
      action: "invitation.created",
      resourceType: "invitation",
      resourceId: invitation.id,
      newValues: { email, role },
    });

    // Email the invite link (the raw token exists only here). Best-effort, after
    // the response — the shareable link is still returned regardless, so the
    // invite flow never depends on email being configured.
    after(() =>
      notifyUserInvited({
        orgId: org.id,
        toEmail: email,
        organizationName: org.name,
        inviterName: member.name,
        role,
        acceptUrl: `${APP_URL}/invite/${rawToken}`,
        expiresInDays: INVITE_TTL_DAYS,
      })
    );
    after(() => track(ANALYTICS_EVENTS.TEAM_MEMBER_INVITED, analytics, { invitedRole: role }));

    revalidatePath("/settings/members");
    return { success: true, invitation: toDTO(invitation, rawToken) };
  } catch (err) {
    console.error("createInvitation error:", err);
    return { success: false, error: "Could not create the invitation." };
  }
}

/** List invitations for the current workspace (most recent first). */
export async function listInvitations(): Promise<InvitationDTO[]> {
  const { org, member } = await getAuthContext();
  if (!ASSIGNABLE_ROLES.includes(member.role) && member.role !== "OWNER") return [];
  requireRole(member.role, "ADMIN");

  const rows = await db.invitation.findMany({
    where: { orgId: org.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map((r) => toDTO(r));
}

/** Revoke a pending invitation (org-scoped). */
export async function revokeInvitation(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { org, member } = await getAuthContext();
    requireRole(member.role, "ADMIN");

    // Scope the update to this org so a token id from another tenant is a no-op.
    const res = await db.invitation.updateMany({
      where: { id, orgId: org.id, status: "PENDING" },
      data: { status: "REVOKED" },
    });
    if (res.count === 0) {
      return { success: false, error: "Invitation not found or already used." };
    }

    await logAudit({
      orgId: org.id,
      memberId: member.id,
      action: "invitation.revoked",
      resourceType: "invitation",
      resourceId: id,
    });

    revalidatePath("/settings/members");
    return { success: true };
  } catch (err) {
    console.error("revokeInvitation error:", err);
    return { success: false, error: "Could not revoke the invitation." };
  }
}
