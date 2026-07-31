"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

/**
 * Customer signals they've wired payment for an invoice. This does NOT activate
 * the plan — it flags the invoice so the operator confirms receipt.
 */
export function ReportPaymentButton({
  invoiceId,
  reported,
}: {
  invoiceId: string;
  reported: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function report() {
    const ref = window.prompt(
      "Enter your bank transfer / wire reference (optional) so we can match your payment:",
      ""
    );
    if (ref === null) return; // cancelled
    setBusy(true);
    try {
      const res = await fetch(`/api/billing/invoices/${invoiceId}/report-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: ref.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not report payment");
      toast({
        title: "Thanks — payment reported",
        description: "We'll confirm receipt and activate your plan shortly.",
      });
      router.refresh();
    } catch (err) {
      toast({
        title: "Couldn't report payment",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  if (reported) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
        <CheckCircle2 className="h-3.5 w-3.5" /> Payment reported — awaiting confirmation
      </span>
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={report} disabled={busy} className="gap-2">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      I&apos;ve sent payment
    </Button>
  );
}
