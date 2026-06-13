"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Trash2, Upload, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { removeDemo } from "@/lib/actions/demo";
import { isClientAnalyticsConfigured, posthog } from "@/lib/analytics/posthog-client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

/**
 * Conversion banner shown on the SAMPLE tender. Labels it clearly as sample data
 * and pushes the user toward real usage (upload / invite), with a one-click
 * remove. Fires demo_tender_viewed on mount (the demo-funnel anchor).
 */
export function SampleBanner() {
  const router = useRouter();
  const [pending, start] = useTransition();

  useEffect(() => {
    if (isClientAnalyticsConfigured()) posthog.capture(ANALYTICS_EVENTS.DEMO_TENDER_VIEWED);
  }, []);

  function remove() {
    start(async () => {
      const res = await removeDemo();
      if (!res.success) {
        toast({ title: "Couldn't remove", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: "Sample removed" });
      router.push("/tenders");
      router.refresh();
    });
  }

  return (
    <div className="mb-6 rounded-2xl border border-blue-200/70 bg-gradient-to-br from-blue-50 to-indigo-50 p-5 dark:border-blue-900/40 dark:from-blue-950/40 dark:to-indigo-950/30">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              You&apos;re exploring a sample tender
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Everything here — requirements, compliance matrix, bid score, proposal draft — was
              produced by TenderOS. Ready to analyze your own tender?
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm">
            <Link href="/tenders/new?step=upload">
              <Upload className="h-4 w-4" /> Upload your tender
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/settings/members">
              <UserPlus className="h-4 w-4" /> Invite a teammate
            </Link>
          </Button>
          <Button onClick={remove} size="sm" variant="ghost" disabled={pending} className="text-slate-500">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Remove sample
          </Button>
        </div>
      </div>
    </div>
  );
}
