"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { startDemo } from "@/lib/actions/demo";

/**
 * One-click entry to Demo Mode — seeds the sample tender (idempotent) and jumps
 * into it. Used on the dashboard checklist and the empty Tenders state.
 */
export function TrySampleTenderButton({
  variant = "default",
  size = "default",
  label = "Try a sample tender",
  className,
}: {
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function go() {
    start(async () => {
      const res = await startDemo();
      if (!res.success || !res.tenderId) {
        toast({ title: "Couldn't load the sample", description: res.error, variant: "destructive" });
        return;
      }
      router.push(`/tenders/${res.tenderId}`);
    });
  }

  return (
    <Button onClick={go} disabled={pending} variant={variant} size={size} className={className}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {label}
    </Button>
  );
}
