"use client";

import { useRouter } from "next/navigation";
import { Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAIJob } from "@/hooks/use-ai-job";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ExtractRequirementsButtonProps {
  tenderId: string;
  documentIds: string[];
  hasExistingRequirements: boolean;
  className?: string;
}

const STATUS_LABELS: Record<string, string> = {
  idle: "Extract Requirements with AI",
  QUEUED: "Queued...",
  PROCESSING: "Extracting requirements...",
  COMPLETED: "Extraction complete",
  FAILED: "Extraction failed",
};

export function ExtractRequirementsButton({
  tenderId,
  documentIds,
  hasExistingRequirements,
  className,
}: ExtractRequirementsButtonProps) {
  const router = useRouter();

  const { state, run, isRunning } = useAIJob({
    onComplete: (result) => {
      const r = result as { total?: number; mandatory?: number } | null;
      toast({
        title: "Requirements extracted ✓",
        description: `${r?.total ?? 0} requirements found (${r?.mandatory ?? 0} mandatory)`,
      });
      router.refresh();
    },
    onError: (error) => {
      toast({
        title: "Extraction failed",
        description: error,
        variant: "destructive",
      });
    },
  });

  function handleExtract() {
    if (isRunning) return;

    if (
      hasExistingRequirements &&
      !confirm(
        "This will replace existing AI-extracted requirements. Manually added requirements will be preserved. Continue?"
      )
    ) {
      return;
    }

    run(() =>
      fetch("/api/ai/extract-requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenderId, documentIds }),
      })
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Button
        onClick={handleExtract}
        disabled={isRunning || documentIds.length === 0}
        className="gap-2"
        variant={state.status === "FAILED" ? "destructive" : "default"}
      >
        {isRunning ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {STATUS_LABELS[state.status]}
          </>
        ) : state.status === "FAILED" ? (
          <>
            <AlertTriangle className="h-4 w-4" />
            Retry Extraction
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            {hasExistingRequirements ? "Re-extract" : "Extract"} Requirements
          </>
        )}
      </Button>

      {/* Progress bar during extraction */}
      {isRunning && (
        <div className="space-y-1">
          <Progress value={state.progress} className="h-1.5" />
          <p className="text-xs text-slate-500">
            {state.progress}% — Claude is analyzing the document...
          </p>
        </div>
      )}

      {documentIds.length === 0 && (
        <p className="text-xs text-slate-500">
          Upload and process a document first
        </p>
      )}

      {state.errorMessage && (
        <p className="text-xs text-red-600">{state.errorMessage}</p>
      )}
    </div>
  );
}
