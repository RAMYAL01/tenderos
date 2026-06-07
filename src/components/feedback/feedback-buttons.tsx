"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, Check, Loader2 } from "lucide-react";
import { recordAIFeedback, type RecordFeedbackInput } from "@/lib/actions/feedback";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Base = Omit<RecordFeedbackInput, "action" | "humanOutput" | "reason">;

/**
 * Compact 👍/👎 control that records expert feedback on an AI output (Phase-3
 * flywheel). 👍 = ACCEPT (the model got it right), 👎 = REJECT (+ optional
 * reason → hard-negative signal). EDIT signals are recorded separately by the
 * host component when the user overrides a value.
 */
export function FeedbackButtons({ base, className }: { base: Base; className?: string }) {
  const [done, setDone] = useState<null | "ACCEPT" | "REJECT">(null);
  const [busy, setBusy] = useState(false);

  async function send(action: "ACCEPT" | "REJECT", reason?: string) {
    setBusy(true);
    try {
      const res = await recordAIFeedback({ ...base, action, reason });
      if (!res.success) throw new Error(res.error);
      setDone(action);
      toast({
        title: action === "ACCEPT" ? "Marked correct ✓" : "Feedback recorded — thanks",
        description: "This helps train the tender model.",
      });
    } catch (err) {
      toast({
        title: "Couldn't save feedback",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[11px] font-medium",
          done === "ACCEPT" ? "text-emerald-600" : "text-slate-400",
          className
        )}
      >
        <Check className="h-3.5 w-3.5" />
        {done === "ACCEPT" ? "Confirmed" : "Noted"}
      </span>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
      ) : (
        <>
          <button
            type="button"
            title="The AI got this right"
            onClick={() => send("ACCEPT")}
            className="rounded p-1 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="The AI was wrong"
            onClick={() => {
              const reason = window.prompt("What was wrong? (optional — helps training)") ?? undefined;
              send("REJECT", reason || undefined);
            }}
            className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
