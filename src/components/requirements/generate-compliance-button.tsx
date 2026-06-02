"use client";

import { useRouter } from "next/navigation";
import { CheckSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAIJob } from "@/hooks/use-ai-job";
import { toast } from "@/hooks/use-toast";

interface GenerateComplianceButtonProps {
  tenderId: string;
  hasExistingCompliance: boolean;
}

export function GenerateComplianceButton({
  tenderId,
  hasExistingCompliance,
}: GenerateComplianceButtonProps) {
  const router = useRouter();

  const { run, isRunning } = useAIJob({
    onComplete: () => {
      toast({
        title: "Compliance matrix generated ✓",
        description: "Requirements have been mapped to proposal sections.",
      });
      router.push(`/tenders/${tenderId}/compliance`);
    },
    onError: (error) => {
      toast({ title: "Failed", description: error, variant: "destructive" });
    },
  });

  function handleGenerate() {
    if (
      hasExistingCompliance &&
      !confirm("This will regenerate the compliance matrix. Existing responses will be preserved. Continue?")
    ) return;

    run(() =>
      fetch("/api/ai/generate-compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenderId }),
      })
    );
  }

  return (
    <Button
      variant="outline"
      onClick={handleGenerate}
      disabled={isRunning}
      className="gap-2"
    >
      {isRunning ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <CheckSquare className="h-4 w-4" />
      )}
      {isRunning ? "Generating..." : "Generate Compliance Matrix"}
    </Button>
  );
}
