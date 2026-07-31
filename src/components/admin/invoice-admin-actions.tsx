"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, Ban, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";

/**
 * Operator row actions for an invoice. Mark-paid activates the org's plan;
 * send issues a draft; void cancels an unpaid invoice.
 */
export function InvoiceAdminActions({
  invoiceId,
  status,
  paymentReference,
}: {
  invoiceId: string;
  status: string;
  paymentReference: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(action: "mark-paid" | "void" | "send", body?: object) {
    setBusy(action);
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      toast({
        title:
          action === "mark-paid"
            ? "Invoice paid — plan activated"
            : action === "void"
            ? "Invoice voided"
            : "Invoice sent",
      });
      router.refresh();
    } catch (err) {
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  }

  function markPaid() {
    const ref = window.prompt(
      "Payment reference (wire ref / bank transaction id) — optional:",
      paymentReference ?? ""
    );
    // Cancel on the prompt dialog aborts the action entirely.
    if (ref === null) return;
    void act("mark-paid", ref.trim() ? { paymentReference: ref.trim() } : {});
  }

  const spin = (name: string) =>
    busy === name ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null;

  const btn =
    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50";

  if (status === "PAID" || status === "VOID") {
    return <span className="text-xs text-slate-400">—</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={markPaid}
        disabled={busy !== null}
        className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}
      >
        {spin("mark-paid") ?? <CheckCircle2 className="h-3.5 w-3.5" />}
        Mark paid
      </button>
      {status === "DRAFT" && (
        <button
          onClick={() => act("send")}
          disabled={busy !== null}
          className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}
        >
          {spin("send") ?? <Send className="h-3.5 w-3.5" />}
          Send
        </button>
      )}
      <button
        onClick={() => {
          if (window.confirm("Void this invoice? This cannot be undone.")) act("void");
        }}
        disabled={busy !== null}
        className={`${btn} text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800`}
      >
        {spin("void") ?? <Ban className="h-3.5 w-3.5" />}
        Void
      </button>
    </div>
  );
}
