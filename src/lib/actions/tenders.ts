"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthContext, requireRole } from "@/lib/auth";

// ── Validation ────────────────────────────────────────────────────────────────

const CreateTenderSchema = z.object({
  titleEn: z.string().min(3, "Title must be at least 3 characters").max(300),
  titleAr: z.string().max(300).optional(),
  referenceNo: z.string().max(100).optional(),
  clientName: z.string().max(200).optional(),
  clientNameAr: z.string().max(200).optional(),
  clientCountry: z.string().length(2).optional().or(z.literal("")),
  sector: z.string().optional(),
  tenderType: z.enum(["RFP", "RFQ", "ITB", "EOI", "ITT", "RFI"]).optional(),
  submissionDeadline: z.string().optional(),   // ISO date string
  estimatedValue: z.number().positive().optional(),
  currency: z.string().length(3).default("USD"),
  primaryLanguage: z.enum(["EN", "AR", "AR_SA", "AR_AE", "AR_EG", "BILINGUAL"]).default("EN"),
  notes: z.string().max(2000).optional(),
  assignedManagerId: z.string().optional(),
});

const UpdateTenderSchema = CreateTenderSchema.partial().extend({
  status: z.enum(["DRAFT", "ACTIVE", "SUBMITTED", "WON", "LOST", "NO_DECISION", "CANCELLED"]).optional(),
  lossReason: z.string().optional(),
  outcomeNotes: z.string().max(2000).optional(),
});

export interface TenderActionResult {
  success: boolean;
  tenderId?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * Create a new tender project.
 * Redirects to /tenders/[id] after creation.
 */
export async function createTender(
  data: z.infer<typeof CreateTenderSchema>
): Promise<TenderActionResult> {
  try {
    const { org, member } = await getAuthContext();
    requireRole(member.role, "WRITER");

    const validated = CreateTenderSchema.safeParse(data);
    if (!validated.success) {
      return {
        success: false,
        fieldErrors: validated.error.flatten().fieldErrors,
      };
    }

    const {
      titleEn,
      titleAr,
      referenceNo,
      clientName,
      clientNameAr,
      clientCountry,
      sector,
      tenderType,
      submissionDeadline,
      estimatedValue,
      currency,
      primaryLanguage,
      notes,
      assignedManagerId,
    } = validated.data;

    const tender = await db.tender.create({
      data: {
        orgId: org.id,
        titleEn,
        titleAr: titleAr || null,
        referenceNo: referenceNo || null,
        clientName: clientName || null,
        clientNameAr: clientNameAr || null,
        clientCountry: clientCountry || null,
        sector: sector || null,
        tenderType: tenderType || null,
        submissionDeadline: submissionDeadline
          ? new Date(submissionDeadline)
          : null,
        estimatedValue: estimatedValue ?? null,
        currency,
        primaryLanguage: primaryLanguage as any,
        status: "DRAFT",
        notes: notes || null,
        createdById: member.id,
        assignedManagerId: assignedManagerId || null,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/tenders");

    return { success: true, tenderId: tender.id };
  } catch (err) {
    if (err instanceof Error && err.message.includes("Requires")) {
      return { success: false, error: "Insufficient permissions." };
    }
    console.error("createTender error:", err);
    return { success: false, error: "Failed to create tender. Please try again." };
  }
}

/**
 * Update an existing tender.
 */
export async function updateTender(
  tenderId: string,
  data: z.infer<typeof UpdateTenderSchema>
): Promise<TenderActionResult> {
  try {
    const { org, member } = await getAuthContext();
    requireRole(member.role, "WRITER");

    const tender = await db.tender.findFirst({
      where: { id: tenderId, orgId: org.id, deletedAt: null },
    });

    if (!tender) return { success: false, error: "Tender not found." };

    const validated = UpdateTenderSchema.safeParse(data);
    if (!validated.success) {
      return { success: false, fieldErrors: validated.error.flatten().fieldErrors };
    }

    await db.tender.update({
      where: { id: tenderId },
      data: {
        ...validated.data,
        submissionDeadline: validated.data.submissionDeadline
          ? new Date(validated.data.submissionDeadline)
          : undefined,
        primaryLanguage: validated.data.primaryLanguage as any,
        status: validated.data.status as any,
        lossReason: validated.data.lossReason as any,
        clientCountry: validated.data.clientCountry || null,
        assignedManagerId: validated.data.assignedManagerId || null,
      },
    });

    revalidatePath(`/tenders/${tenderId}`);
    revalidatePath("/tenders");
    revalidatePath("/dashboard");

    return { success: true, tenderId };
  } catch (err) {
    console.error("updateTender error:", err);
    return { success: false, error: "Failed to update tender." };
  }
}

/**
 * Delete a tender (soft delete).
 */
export async function deleteTender(tenderId: string): Promise<TenderActionResult> {
  try {
    const { org, member } = await getAuthContext();
    requireRole(member.role, "MANAGER");

    await db.tender.update({
      where: { id: tenderId, orgId: org.id },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/tenders");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (err) {
    console.error("deleteTender error:", err);
    return { success: false, error: "Failed to delete tender." };
  }
}
