"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

type Tier = "STARTER" | "PROFESSIONAL" | "BUSINESS" | "ENTERPRISE";
type Cycle = "monthly" | "annual";

interface OrgOption {
  id: string;
  name: string;
  planTier: string;
}

/** List prices (USD/month). Mirrors PLAN_LIMITS on the server. */
const MONTHLY: Record<Tier, number> = {
  STARTER: 149,
  PROFESSIONAL: 499,
  BUSINESS: 1299,
  ENTERPRISE: 0,
};

/** Suggested total in whole USD for a tier + cycle (annual = 20% off × 12). */
function suggestedDollars(tier: Tier, cycle: Cycle): number {
  const m = MONTHLY[tier];
  if (m === 0) return 0;
  return cycle === "annual" ? Math.round(m * 0.8) * 12 : m;
}

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-900/40";
const labelCls = "mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400";

export function CreateInvoiceForm({
  orgs,
  emailLive = false,
}: {
  orgs: OrgOption[];
  /** True when Resend is configured, so issuing also emails the invoice. */
  emailLive?: boolean;
}) {
  const router = useRouter();
  const [orgId, setOrgId] = useState(orgs[0]?.id ?? "");
  const [tier, setTier] = useState<Tier>("PROFESSIONAL");
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [amount, setAmount] = useState<string>(String(suggestedDollars("PROFESSIONAL", "monthly")));
  const [amountEdited, setAmountEdited] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [dueInDays, setDueInDays] = useState("14");
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [notes, setNotes] = useState("");
  const [sendNow, setSendNow] = useState(true);
  const [busy, setBusy] = useState(false);

  // Keep the amount in sync with tier/cycle until the operator overrides it.
  useEffect(() => {
    if (!amountEdited) setAmount(String(suggestedDollars(tier, cycle)));
  }, [tier, cycle, amountEdited]);

  async function submit() {
    if (!orgId) {
      toast({ title: "Pick an organization", variant: "destructive" });
      return;
    }
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars < 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          planTier: tier,
          billingCycle: cycle,
          amountCents: Math.round(dollars * 100),
          currency,
          dueInDays: Number(dueInDays) || 14,
          paymentInstructions: paymentInstructions.trim() || undefined,
          notes: notes.trim() || undefined,
          sendNow,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create invoice");
      toast({
        title: `Invoice ${data.invoice.number} created`,
        description: !sendNow
          ? "Saved as draft."
          : emailLive
          ? "Issued and emailed to the customer."
          : "Issued — visible in the customer's billing page (email is off until Resend is set).",
      });
      setNotes("");
      setAmountEdited(false);
      router.refresh();
    } catch (err) {
      toast({
        title: "Could not create invoice",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="sm:col-span-2 lg:col-span-1">
        <label className={labelCls}>Organization</label>
        <select className={inputCls} value={orgId} onChange={(e) => setOrgId(e.target.value)}>
          {orgs.length === 0 && <option value="">No organizations</option>}
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.planTier})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelCls}>Plan</label>
        <select
          className={inputCls}
          value={tier}
          onChange={(e) => {
            setTier(e.target.value as Tier);
            setAmountEdited(false);
          }}
        >
          <option value="STARTER">Starter</option>
          <option value="PROFESSIONAL">Professional</option>
          <option value="BUSINESS">Business</option>
          <option value="ENTERPRISE">Enterprise (custom)</option>
        </select>
      </div>

      <div>
        <label className={labelCls}>Billing cycle</label>
        <select
          className={inputCls}
          value={cycle}
          onChange={(e) => {
            setCycle(e.target.value as Cycle);
            setAmountEdited(false);
          }}
        >
          <option value="monthly">Monthly</option>
          <option value="annual">Annual (−20%)</option>
        </select>
      </div>

      <div>
        <label className={labelCls}>Amount ({currency})</label>
        <input
          className={inputCls}
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setAmountEdited(true);
          }}
        />
      </div>

      <div>
        <label className={labelCls}>Currency</label>
        <input
          className={inputCls}
          value={currency}
          maxLength={3}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
        />
      </div>

      <div>
        <label className={labelCls}>Due in (days)</label>
        <input
          className={inputCls}
          inputMode="numeric"
          value={dueInDays}
          onChange={(e) => setDueInDays(e.target.value)}
        />
      </div>

      <div className="sm:col-span-2 lg:col-span-3">
        <label className={labelCls}>Payment instructions (bank / wire details shown to the customer)</label>
        <textarea
          className={`${inputCls} min-h-[72px]`}
          value={paymentInstructions}
          placeholder="Leave blank to use the PLATFORM_PAYMENT_INSTRUCTIONS default."
          onChange={(e) => setPaymentInstructions(e.target.value)}
        />
      </div>

      <div className="sm:col-span-2 lg:col-span-3">
        <label className={labelCls}>Notes (optional)</label>
        <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="flex items-center justify-between sm:col-span-2 lg:col-span-3">
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <input
            type="checkbox"
            checked={sendNow}
            onChange={(e) => setSendNow(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Issue to customer immediately (uncheck to save as draft)
        </label>
        <Button onClick={submit} disabled={busy || !orgId} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Create invoice
        </Button>
      </div>
    </div>
  );
}
