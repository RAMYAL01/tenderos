import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin, PlatformAdminForbiddenError } from "@/lib/auth/platform-admin";
import { createInvoice } from "@/lib/billing/invoices";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";

const CreateSchema = z.object({
  orgId: z.string().min(1),
  planTier: z.enum(["STARTER", "PROFESSIONAL", "BUSINESS", "ENTERPRISE"]),
  billingCycle: z.enum(["monthly", "annual"]).default("monthly"),
  amountCents: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
  dueInDays: z.number().int().min(0).max(365).optional(),
  paymentInstructions: z.string().max(4000).optional(),
  notes: z.string().max(4000).optional(),
  sendNow: z.boolean().optional(),
});

/** POST /api/admin/invoices — operator creates an invoice for an org. */
export async function POST(req: Request) {
  let operatorId: string;
  try {
    operatorId = (await requirePlatformAdmin()).userId;
  } catch (err) {
    if (err instanceof PlatformAdminForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const org = await db.organization.findUnique({ where: { id: input.orgId }, select: { id: true } });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  try {
    const invoice = await createInvoice({ ...input, createdByUserId: operatorId });
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (err) {
    console.error("[admin/invoices] create failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create invoice" },
      { status: 500 }
    );
  }
}
