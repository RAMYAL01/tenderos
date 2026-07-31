import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin, PlatformAdminForbiddenError } from "@/lib/auth/platform-admin";
import { markInvoicePaid } from "@/lib/billing/invoices";

export const runtime = "nodejs";

const BodySchema = z.object({ paymentReference: z.string().max(200).optional() });

/** POST /api/admin/invoices/[id]/mark-paid — confirm payment & activate plan. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let operatorId: string;
  try {
    operatorId = (await requirePlatformAdmin()).userId;
  } catch (err) {
    if (err instanceof PlatformAdminForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  const paymentReference = parsed.success ? parsed.data.paymentReference : undefined;

  try {
    const invoice = await markInvoicePaid(id, { paidByUserId: operatorId, paymentReference });
    return NextResponse.json({ invoice });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not mark invoice paid";
    const status = msg.includes("not found") ? 404 : msg.includes("void") ? 409 : 500;
    if (status === 500) console.error("[admin/invoices/mark-paid] failed:", err);
    return NextResponse.json({ error: msg }, { status });
  }
}
