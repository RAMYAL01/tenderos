"use client";

import { useState } from "react";
import { Check, Loader2, ArrowUpRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type BillingCycle = "monthly" | "annual";

interface PlanOption {
  tier: "STARTER" | "PROFESSIONAL" | "BUSINESS";
  label: string;
  monthly: number;
  blurb: string;
  highlighted?: boolean;
}

const PLANS: PlanOption[] = [
  { tier: "STARTER", label: "Starter", monthly: 149, blurb: "Small contractors getting started." },
  { tier: "PROFESSIONAL", label: "Professional", monthly: 499, blurb: "Growing firms with multiple bids.", highlighted: true },
  { tier: "BUSINESS", label: "Business", monthly: 1299, blurb: "High bid volume & dedicated teams." },
];

const TIER_RANK: Record<string, number> = { STARTER: 1, PROFESSIONAL: 2, BUSINESS: 3, ENTERPRISE: 4 };

export function BillingActions({
  currentTier,
  hasPaidSub,
  canManage,
  billingEnabled,
}: {
  currentTier: string;
  hasPaidSub: boolean;
  canManage: boolean;
  billingEnabled: boolean;
}) {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [busy, setBusy] = useState<string | null>(null);

  async function startCheckout(tier: PlanOption["tier"]) {
    if (!canManage) {
      toast({
        title: "Insufficient permissions",
        description: "Only an organization owner or admin can manage billing.",
        variant: "destructive",
      });
      return;
    }
    setBusy(tier);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, cycle }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not start checkout");
      }
      window.location.href = data.url;
    } catch (err) {
      toast({
        title: "Checkout failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy("portal");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not open billing portal");
      }
      window.location.href = data.url;
    } catch (err) {
      toast({
        title: "Couldn't open billing portal",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
      setBusy(null);
    }
  }

  if (!billingEnabled) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/50">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          <strong>Billing isn&apos;t configured yet.</strong> Once Stripe keys are
          set, plan selection and self-serve upgrades appear here. Meanwhile,
          contact{" "}
          <a href="mailto:support@thetenderos.com" className="text-blue-600 hover:underline">
            support@thetenderos.com
          </a>
          .
        </p>
      </div>
    );
  }

  const currentRank = TIER_RANK[currentTier] ?? 0;

  return (
    <div className="space-y-5">
      {/* Manage existing billing */}
      {hasPaidSub && (
        <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Manage your subscription
            </p>
            <p className="text-sm text-slate-500">
              Update your card, download invoices, change or cancel your plan.
            </p>
          </div>
          <Button
            onClick={openPortal}
            disabled={busy !== null || !canManage}
            className="gap-2"
          >
            {busy === "portal" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            Manage billing
          </Button>
        </div>
      )}

      {/* Plan picker */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {hasPaidSub ? "Change plan" : "Choose a plan"}
          </h3>
          {/* Billing cycle toggle */}
          <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
            <button
              onClick={() => setCycle("monthly")}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-medium transition-all",
                cycle === "monthly"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                  : "text-slate-500"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setCycle("annual")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-all",
                cycle === "annual"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                  : "text-slate-500"
              )}
            >
              Annual
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                -20%
              </span>
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => {
            const price = cycle === "annual" ? Math.round(plan.monthly * 0.8) : plan.monthly;
            const isCurrent = plan.tier === currentTier;
            const rank = TIER_RANK[plan.tier];
            const isDowngrade = rank < currentRank;
            return (
              <div
                key={plan.tier}
                className={cn(
                  "flex flex-col rounded-xl border p-5",
                  plan.highlighted
                    ? "border-blue-300 bg-blue-50/40 dark:border-blue-800 dark:bg-blue-950/20"
                    : "border-slate-200 dark:border-slate-800"
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {plan.label}
                  </p>
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                      <Check className="h-3 w-3" /> Current
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">{plan.blurb}</p>
                <div className="mt-3 flex items-end gap-1">
                  <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                    ${price.toLocaleString()}
                  </span>
                  <span className="mb-1 text-xs text-slate-400">/mo</span>
                </div>
                <p className="mt-0.5 h-4 text-[11px] text-emerald-600">
                  {cycle === "annual" ? `billed $${(price * 12).toLocaleString()}/yr` : ""}
                </p>
                <Button
                  onClick={() => startCheckout(plan.tier)}
                  disabled={busy !== null || isCurrent || !canManage}
                  variant={plan.highlighted && !isCurrent ? "default" : "outline"}
                  className="mt-4 w-full gap-2"
                >
                  {busy === plan.tier ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isCurrent ? null : (
                    <ArrowUpRight className="h-4 w-4" />
                  )}
                  {isCurrent ? "Current plan" : isDowngrade ? "Switch" : "Upgrade"}
                </Button>
              </div>
            );
          })}
        </div>

        {!canManage && (
          <p className="mt-4 text-xs text-amber-600">
            Only an organization owner or admin can change the plan.
          </p>
        )}
      </div>
    </div>
  );
}
