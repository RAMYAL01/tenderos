"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthContext, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/security/audit";

// ── Validation schemas ────────────────────────────────────────────────────────

const UpdateWorkspaceSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  nameAr: z.string().max(100).optional(),
  industry: z.string().optional(),
  website: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
  defaultLanguage: z.enum(["EN", "AR", "AR_SA", "AR_AE", "AR_EG", "BILINGUAL"]),
  countryCode: z.string().length(2).optional().or(z.literal("")),
});

export type UpdateWorkspaceInput = z.infer<typeof UpdateWorkspaceSchema>;

export interface ActionResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * Update workspace (organization) settings.
 * Requires ADMIN or OWNER role.
 */
export async function updateWorkspace(
  data: UpdateWorkspaceInput
): Promise<ActionResult> {
  try {
    const { org, member } = await getAuthContext();
    requireRole(member.role, "ADMIN");

    const validated = UpdateWorkspaceSchema.safeParse(data);
    if (!validated.success) {
      return {
        success: false,
        fieldErrors: validated.error.flatten().fieldErrors,
      };
    }

    const { name, nameAr, industry, website, defaultLanguage, countryCode } =
      validated.data;

    await db.organization.update({
      where: { id: org.id },
      data: {
        name,
        nameAr: nameAr || null,
        industry: industry || null,
        website: website || null,
        defaultLanguage,
        countryCode: countryCode || null,
      },
    });

    revalidatePath("/settings/workspace");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.message.includes("Requires")) {
      return { success: false, error: "You don't have permission to do this." };
    }
    console.error("updateWorkspace error:", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

/**
 * Update a team member's role.
 * Requires ADMIN or OWNER role.
 * OWNER role cannot be changed.
 */
export async function updateMemberRole(
  memberId: string,
  newRole: string
): Promise<ActionResult> {
  try {
    const { org, member: currentMember } = await getAuthContext();
    requireRole(currentMember.role, "ADMIN");

    const targetMember = await db.member.findFirst({
      where: { id: memberId, orgId: org.id, isActive: true },
    });

    if (!targetMember) {
      return { success: false, error: "Member not found." };
    }

    // Can't change the OWNER's role
    if (targetMember.role === "OWNER") {
      return { success: false, error: "Cannot change the workspace owner's role." };
    }

    // Only OWNER can grant ADMIN
    if (newRole === "ADMIN" && currentMember.role !== "OWNER") {
      return { success: false, error: "Only the workspace owner can grant admin role." };
    }

    await db.member.update({
      where: { id: memberId },
      data: { role: newRole as any },
    });

    await logAudit({
      orgId: org.id,
      memberId: currentMember.id,
      action: "member.role_changed",
      resourceType: "member",
      resourceId: targetMember.id,
      oldValues: { role: targetMember.role },
      newValues: { role: newRole },
      metadata: { targetEmail: targetMember.email },
    });

    revalidatePath("/settings/members");
    return { success: true };
  } catch (err) {
    console.error("updateMemberRole error:", err);
    return { success: false, error: "Something went wrong." };
  }
}

/**
 * Remove a team member from the workspace.
 * Requires ADMIN or OWNER role.
 */
export async function removeMember(memberId: string): Promise<ActionResult> {
  try {
    const { org, member: currentMember } = await getAuthContext();
    requireRole(currentMember.role, "ADMIN");

    const targetMember = await db.member.findFirst({
      where: { id: memberId, orgId: org.id, isActive: true },
    });

    if (!targetMember) {
      return { success: false, error: "Member not found." };
    }

    // Can't remove the owner
    if (targetMember.role === "OWNER") {
      return { success: false, error: "Cannot remove the workspace owner." };
    }

    // Can't remove yourself
    if (targetMember.id === currentMember.id) {
      return { success: false, error: "You cannot remove yourself." };
    }

    await db.member.update({
      where: { id: memberId },
      data: { isActive: false, deletedAt: new Date() },
    });

    await logAudit({
      orgId: org.id,
      memberId: currentMember.id,
      action: "member.removed",
      resourceType: "member",
      resourceId: targetMember.id,
      oldValues: { role: targetMember.role, email: targetMember.email },
    });

    revalidatePath("/settings/members");
    return { success: true };
  } catch (err) {
    console.error("removeMember error:", err);
    return { success: false, error: "Something went wrong." };
  }
}
