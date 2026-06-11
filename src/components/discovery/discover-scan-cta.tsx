"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { scanForOpportunities } from "@/lib/actions/opportunities";

/** Bounded, user-initiated match trigger (matching never runs on page render). */
export function DiscoverScanCta() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function scan() {
    start(async () => {
      const res = await scanForOpportunities();
      if (!res.success) {
        toast({ title: "Couldn't scan", description: res.error, variant: "destructive" });
        return;
      }
      toast({
        title: res.matched > 0 ? `${res.matched} matched opportunities` : "No strong matches yet",
        description: res.matched > 0 ? "Ranked by fit to your company." : "Try again once your profile or won tenders are richer.",
      });
      router.refresh();
    });
  }

  return (
    <Button size="lg" onClick={scan} disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {pending ? "Scanning…" : "Find matched opportunities"}
    </Button>
  );
}
