"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthContext, requireRole } from "@/lib/auth";
import type { CostCategory } from "@prisma/client";

export interface ActionResult {
  success: boolean;
  id?: string;
  error?: string;
}

function isRedirect(err: unknown): boolean {
  return (
    !!err &&
    typeof err === "object" &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

async function ownedFinancial(orgId: string, financialId: string) {
  return db.financialProposal.findFirst({
    where: { id: financialId, orgId, deletedAt: null },
    select: { id: true, tenderId: true },
  });
}

/** Create (or return existing) financial proposal for a tender. */
export async function ensureFinancialProposal(
  tenderId: string
): Promise<ActionResult> {
  try {
    const { org, member } = await getAuthContext();
    requireRole(member.role, "WRITER");

    const tender = await db.tender.findFirst({
      where: { id: tenderId, orgId: org.id, deletedAt: null },
      select: { id: true, currency: true },
    });
    if (!tender) return { success: false, error: "Tender not found." };

    const existing = await db.financialProposal.findFirst({
      where: { tenderId, orgId: org.id, deletedAt: null },
      select: { id: true },
    });
    if (existing) return { success: true, id: existing.id };

    const created = await db.financialProposal.create({
      data: {
        tenderId,
        orgId: org.id,
        currency: tender.currency ?? "SAR",
        createdById: member.id,
      },
    });

    revalidatePath(`/tenders/${tenderId}/financial`);
    return { success: true, id: created.id };
  } catch (err) {
    if (isRedirect(err)) throw err;
    console.error("ensureFinancialProposal error:", err);
    return { success: false, error: "Failed to create financial proposal." };
  }
}

const AssumptionsSchema = z.object({
  currency: z.string().length(3).optional(),
  overheadPct: z.number().min(0).max(1000),
  contingencyPct: z.number().min(0).max(1000),
  profitMarginPct: z.number().min(0).max(1000),
  vatPct: z.number().min(0).max(100),
  notes: z.string().max(2000).optional(),
});

export async function updateAssumptions(
  financialId: string,
  data: z.infer<typeof AssumptionsSchema>
): Promise<ActionResult> {
  try {
    const { org, member } = await getAuthContext();
    requireRole(member.role, "WRITER");

    const fin = await ownedFinancial(org.id, financialId);
    if (!fin) return { success: false, error: "Not found." };

    const parsed = AssumptionsSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "Invalid values." };

    await db.financialProposal.update({
      where: { id: financialId },
      data: { ...parsed.data },
    });

    revalidatePath(`/tenders/${fin.tenderId}/financial`);
    return { success: true };
  } catch (err) {
    if (isRedirect(err)) throw err;
    console.error("updateAssumptions error:", err);
    return { success: false, error: "Failed to update." };
  }
}

const CostLineSchema = z.object({
  category: z.enum([
    "LABOR",
    "EQUIPMENT",
    "MATERIAL",
    "SUBCONTRACTOR",
    "TRANSPORT",
    "OTHER_DIRECT",
  ]),
  itemRef: z.string().max(50).optional(),
  description: z.string().min(1, "Description required").max(500),
  unit: z.string().max(20).optional(),
  quantity: z.number().min(0),
  unitRate: z.number().min(0),
  source: z.string().max(200).optional(),
});

export async function addCostLine(
  financialId: string,
  data: z.infer<typeof CostLineSchema>
): Promise<ActionResult> {
  try {
    const { org, member } = await getAuthContext();
    requireRole(member.role, "WRITER");

    const fin = await ownedFinancial(org.id, financialId);
    if (!fin) return { success: false, error: "Not found." };

    const parsed = CostLineSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid line." };
    }

    const count = await db.costLine.count({ where: { financialProposalId: financialId } });
    const line = await db.costLine.create({
      data: {
        financialProposalId: financialId,
        orgId: org.id,
        category: parsed.data.category as CostCategory,
        itemRef: parsed.data.itemRef || null,
        description: parsed.data.description,
        unit: parsed.data.unit || null,
        quantity: parsed.data.quantity,
        unitRate: parsed.data.unitRate,
        source: parsed.data.source || null,
        orderIndex: count,
      },
    });

    revalidatePath(`/tenders/${fin.tenderId}/financial`);
    return { success: true, id: line.id };
  } catch (err) {
    if (isRedirect(err)) throw err;
    console.error("addCostLine error:", err);
    return { success: false, error: "Failed to add line." };
  }
}

export async function deleteCostLine(lineId: string): Promise<ActionResult> {
  try {
    const { org, member } = await getAuthContext();
    requireRole(member.role, "WRITER");

    const line = await db.costLine.findFirst({
      where: { id: lineId, orgId: org.id },
      select: { id: true, financialProposal: { select: { tenderId: true } } },
    });
    if (!line) return { success: false, error: "Not found." };

    await db.costLine.delete({ where: { id: lineId } });
    revalidatePath(`/tenders/${line.financialProposal.tenderId}/financial`);
    return { success: true };
  } catch (err) {
    if (isRedirect(err)) throw err;
    console.error("deleteCostLine error:", err);
    return { success: false, error: "Failed to delete line." };
  }
}
