"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ensureFinancialProposal } from "@/lib/actions/financial";
import { toast } from "@/hooks/use-toast";

export function StartFinancialButton({ tenderId }: { tenderId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      onClick={() =>
        start(async () => {
          const res = await ensureFinancialProposal(tenderId);
          if (!res.success) toast({ title: res.error ?? "Failed", variant: "destructive" });
          else router.refresh();
        })
      }
      disabled={pending}
      className="gap-2"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
      Start Financial Proposal
    </Button>
  );
}
