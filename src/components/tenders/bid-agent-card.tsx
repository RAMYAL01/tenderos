"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, Loader2, CheckCircle2, Circle, AlertTriangle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { startBidAgent } from "@/lib/actions/bid-agent";

type WorkflowStatus =
  | "QUEUED" | "EXTRACTING" | "EXTRACTED" | "CHECKING_COMPLIANCE"
  | "COMPLIANCE_READY" | "QUALIFYING" | "QUALIFIED" | "DRAFTING_PROPOSAL"
  | "COMPLETED" | "FAILED";

export interface BidAgentWorkflow {
  id: string;
  status: WorkflowStatus;
  result: {
    requirements?: number;
    complianceRows?: number;
    recommendation?: string;
    proposalId?: string;
    draftedSections?: number;
  } | null;
  error: string | null;
  failedStep: string | null;
}

const STEPS = [
  { key: "extract", label: "Extract requirements" },
  { key: "compliance", label: "Build compliance matrix" },
  { key: "qualify", label: "Bid / No-Bid score" },
  { key: "proposal", label: "Draft proposal" },
] as const;

/** Step index each status is currently working on (COMPLETED = past the last). */
const STAGE: Record<WorkflowStatus, number> = {
  QUEUED: 0, EXTRACTING: 0,
  EXTRACTED: 1, CHECKING_COMPLIANCE: 1,
  COMPLIANCE_READY: 2, QUALIFYING: 2,
  QUALIFIED: 3, DRAFTING_PROPOSAL: 3,
  COMPLETED: 4, FAILED: -1,
};
const FAILED_STAGE: Record<string, number> = { EXTRACTING: 0, CHECKING_COMPLIANCE: 1, QUALIFYING: 2, DRAFTING_PROPOSAL: 3 };
const ACTIVE_STATUSES: WorkflowStatus[] = ["QUEUED", "EXTRACTING", "EXTRACTED", "CHECKING_COMPLIANCE", "COMPLIANCE_READY", "QUALIFYING", "QUALIFIED", "DRAFTING_PROPOSAL"];

function isActive(s?: WorkflowStatus | null): boolean {
  return !!s && ACTIVE_STATUSES.includes(s);
}

export function BidAgentCard({
  tenderId,
  initial,
  canRun,
  hasReadyDocs,
}: {
  tenderId: string;
  initial: BidAgentWorkflow | null;
  canRun: boolean;
  hasReadyDocs: boolean;
}) {
  const router = useRouter();
  const [wf, setWf] = useState<BidAgentWorkflow | null>(initial);
  const [starting, startTransition] = useTransition();
  const pollingRef = useRef(false);

  const poll = useCallback(async () => {
    if (pollingRef.current) return; // never run two poll loops at once
    pollingRef.current = true;
    try {
      // Bounded so a stuck run can't poll forever (≈5 min at 3s/tick).
      for (let i = 0; i < 100; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const res = await fetch(`/api/tenders/${tenderId}/bid-agent`, { cache: "no-store" });
        if (!res.ok) break;
        const data = await res.json();
        const next: BidAgentWorkflow | null = data.workflow ?? null;
        setWf(next);
        if (!next || !isActive(next.status)) {
          if (next?.status === "COMPLETED") router.refresh();
          break;
        }
      }
    } finally {
      pollingRef.current = false;
    }
  }, [tenderId, router]);

  useEffect(() => {
    if (isActive(initial?.status)) void poll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function start() {
    startTransition(async () => {
      const res = await startBidAgent(tenderId);
      if (!res.success) {
        toast({ title: "Couldn't start", description: res.error, variant: "destructive" });
        return;
      }
      setWf({ id: res.workflowId ?? "pending", status: "QUEUED", result: null, error: null, failedStep: null });
      void poll();
    });
  }

  const running = isActive(wf?.status);
  const stage = wf ? STAGE[wf.status] : -99;
  const failedIdx = wf?.status === "FAILED" && wf.failedStep ? FAILED_STAGE[wf.failedStep] ?? -1 : -1;

  function stepState(i: number): "done" | "active" | "error" | "pending" {
    if (wf?.status === "COMPLETED") return "done";
    if (wf?.status === "FAILED") return i < failedIdx ? "done" : i === failedIdx ? "error" : "pending";
    if (!running) return "pending";
    if (i < stage) return "done";
    if (i === stage) return "active";
    return "pending";
  }

  return (
    <div className="rounded-xl border border-violet-200/70 bg-gradient-to-br from-violet-50/60 to-white p-4 dark:border-violet-900/40 dark:from-violet-950/25 dark:to-slate-900">
      <div className="mb-2 flex items-center gap-2">
        <Bot className="h-4 w-4 text-violet-600" />
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Autonomous first-draft</h3>
        <span className="ml-auto rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
          Beta
        </span>
      </div>

      {(!wf || wf.status === "COMPLETED" || wf.status === "FAILED") && (
        <p className="mb-3 text-xs leading-relaxed text-slate-500">
          Extract requirements, build the compliance matrix, and score Bid/No-Bid in one pass — a first draft to review, not send. It keeps running if you leave.
        </p>
      )}

      {wf && (
        <ol className="mb-3 space-y-1.5">
          {STEPS.map((s, i) => {
            const st = stepState(i);
            return (
              <li key={s.key} className="flex items-center gap-2 text-xs">
                {st === "done" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : st === "active" ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-500" />
                ) : st === "error" ? (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-700" />
                )}
                <span
                  className={cn(
                    st === "pending" ? "text-slate-400" : "text-slate-600 dark:text-slate-300",
                    st === "active" && "font-medium"
                  )}
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {wf?.status === "COMPLETED" && wf.result && (
        <div className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          Draft ready — {wf.result.requirements ?? 0} requirements, {wf.result.complianceRows ?? 0} compliance rows
          {wf.result.draftedSections ? `, ${wf.result.draftedSections} proposal section${wf.result.draftedSections === 1 ? "" : "s"} drafted` : ""}
          {wf.result.recommendation ? `, recommendation: ${wf.result.recommendation.replace("_", "-").toLowerCase()}` : ""}. Review below.
        </div>
      )}

      {wf?.status === "FAILED" && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {wf.error ?? "The run failed."} You can start it again.
        </div>
      )}

      {canRun ? (
        running ? (
          <p className="flex items-center gap-1.5 text-[11px] text-violet-600">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Working… this keeps running in the background.
          </p>
        ) : (
          <>
            <Button size="sm" className="w-full" onClick={start} disabled={starting || !hasReadyDocs}>
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {wf ? "Run again" : "Generate first draft"}
            </Button>
            {!hasReadyDocs && (
              <p className="mt-1.5 text-[11px] text-slate-400">Upload and process a tender document first.</p>
            )}
          </>
        )
      ) : (
        <p className="text-[11px] text-slate-400">A Writer or above can run the autonomous draft.</p>
      )}
    </div>
  );
}
