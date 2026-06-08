"use server";

import { randomBytes } from "crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma";
import { getAuthContext, requireRole } from "@/lib/auth";
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
  token: string;
  path: string; // "/invite/<token>" — client composes the absolute URL
  expiresAt: string;
  createdAt: string;
};

type CreateResult =
  | { success: true; invitation: InvitationDTO }
  | { success: false; error: string };

function toDTO(i: {
  id: string;
  email: string;
  role: MemberRole;
  status: InvitationStatus;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}): InvitationDTO {
  return {
    id: i.id,
    email: i.email,
    role: i.role,
    status: i.status,
    token: i.token,
    path: `/invite/${i.token}`,
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
    const { org, member } = await getAuthContext();
    requireRole(member.role, "ADMIN");

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

    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);

    // One active invite per email per workspace — refresh in place.
    const invitation = await db.invitation.upsert({
      where: { orgId_email: { orgId: org.id, email } },
      create: {
        orgId: org.id,
        email,
        role,
        token,
        status: "PENDING",
        invitedById: member.id,
        expiresAt,
      },
      update: {
        role,
        token,
        status: "PENDING",
        invitedById: member.id,
        expiresAt,
        acceptedAt: null,
        acceptedById: null,
      },
    });

    revalidatePath("/settings/members");
    return { success: true, invitation: toDTO(invitation) };
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
  return rows.map(toDTO);
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

    revalidatePath("/settings/members");
    return { success: true };
  } catch (err) {
    console.error("revokeInvitation error:", err);
    return { success: false, error: "Could not revoke the invitation." };
  }
}
