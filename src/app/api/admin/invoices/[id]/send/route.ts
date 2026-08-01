import { NextResponse, after } from "next/server";
import { requirePlatformAdmin, PlatformAdminForbiddenError } from "@/lib/auth/platform-admin";
import { sendInvoice } from "@/lib/billing/invoices";
import { notifyInvoiceIssued } from "@/lib/email/events";

export const runtime = "nodejs";

/** POST /api/admin/invoices/[id]/send — issue a DRAFT invoice to the customer. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin();
  } catch (err) {
    if (err instanceof PlatformAdminForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  const { id } = await params;
  try {
    const invoice = await sendInvoice(id);
    // Email the invoice to the customer (no-ops until Resend is configured).
    if (invoice.status === "SENT") {
      after(() => notifyInvoiceIssued({ orgId: invoice.orgId, invoiceId: invoice.id }));
    }
    return NextResponse.json({ invoice });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not send invoice";
    const status = msg.includes("not found") ? 404 : 500;
    if (status === 500) console.error("[admin/invoices/send] failed:", err);
    return NextResponse.json({ error: msg }, { status });
  }
}
