"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Full-screen lock shown when the workspace's trial has expired or the
 * subscription is unpaid. Settings remain reachable (so billing can be fixed) —
 * everything else is blocked. Rendered by the (dashboard) layout, which decides
 * `locked` server-side via getBillingLock(); the pathname exemption here is what
 * prevents a redirect/render loop on the billing page itself.
 */
export function BillingLockGate({
  locked,
  reason,
  children,
}: {
  locked: boolean;
  reason?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (!locked || pathname.startsWith("/settings")) {
    return <>{children}</>;
  }

  const isTrial = reason === "trial_expired";

  return (
    <div className="flex h-full flex-1 items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950">
          <Lock className="h-6 w-6 text-amber-600" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
          {isTrial ? "Your free trial has ended" : "Payment required"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          {isTrial
            ? "Pick a plan to keep working — all your workspace data is safe and exactly where you left it."
            : "Your subscription payment is outstanding. Update billing to restore access — your data is untouched."}
        </p>
        <Button asChild size="lg" className="mt-6 w-full">
          <Link href="/settings/billing">
            {isTrial ? "Choose a plan" : "Fix billing"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
