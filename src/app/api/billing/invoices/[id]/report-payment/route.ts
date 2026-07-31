import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext, hasRole } from "@/lib/auth";
import { reportPayment } from "@/lib/billing/invoices";

export const runtime = "nodejs";

const BodySchema = z.object({ reference: z.string().max(200).optional() });

/**
 * POST /api/billing/invoices/[id]/report-payment
 *
 * Customer signals they've wired payment. Does not change the plan — it only
 * flags the invoice so the operator knows to confirm receipt. ADMIN+ only.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { org, member } = await getAuthContext();
  if (!hasRole(member.role, "ADMIN")) {
    return NextResponse.json({ error: "Requires ADMIN role" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  const reference = parsed.success ? parsed.data.reference : undefined;

  try {
    const invoice = await reportPayment(id, org.id, reference);
    return NextResponse.json({ invoice });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not report payment";
    const status = msg.includes("not found") ? 404 : 500;
    if (status === 500) console.error("[billing/invoices/report-payment] failed:", err);
    return NextResponse.json({ error: msg }, { status });
  }
}
