import { NextResponse } from "next/server";
import { requirePlatformAdmin, PlatformAdminForbiddenError } from "@/lib/auth/platform-admin";
import { voidInvoice } from "@/lib/billing/invoices";

export const runtime = "nodejs";

/** POST /api/admin/invoices/[id]/void — cancel an unpaid invoice. */
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
    const invoice = await voidInvoice(id);
    return NextResponse.json({ invoice });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not void invoice";
    const status = msg.includes("not found") ? 404 : msg.includes("paid") ? 409 : 500;
    if (status === 500) console.error("[admin/invoices/void] failed:", err);
    return NextResponse.json({ error: msg }, { status });
  }
}
