"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Scale, Loader2, Sparkles, ThumbsUp, ThumbsDown, AlertTriangle,
  HelpCircle, ChevronDown, RotateCcw, CheckCircle2, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useAIJob } from "@/hooks/use-ai-job";
import { recordBidDecision } from "@/lib/actions/bid-decision";

const FACTOR_LABELS: Record<string, string> = {
  profileFit: "Profile fit",
  geographyFit: "Geography",
  valueFit: "Value vs capacity",
  historyFit: "Track record",
  deadlinePressure: "Time to prepare",
  requirementsRisk: "Compliance load",
};

export interface BidDecisionData {
  score: number;
  baseScore: number;
  llmAdjustment: number;
  confidence: number;
  recommendation: "BID" | "NO_BID" | "REVIEW";
  factors: Record<string, number>;
  rationale: string;
  rationaleAr: string | null;
  risks: { title: string; severity: "HIGH" | "MEDIUM" | "LOW"; detail: string }[];
  questionsToAsk: string[];
  humanDecision: "BID" | "NO_BID" | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNotes: string | null;
}

const REC_META = {
  BID: { label: "Bid", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300", ring: "text-emerald-500" },
  NO_BID: { label: "No-bid", cls: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300", ring: "text-red-500" },
  REVIEW: { label: "Needs review", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300", ring: "text-amber-500" },
} as const;

const RISK_CLS: Record<string, string> = {
  HIGH: "text-red-600",
  MEDIUM: "text-amber-600",
  LOW: "text-slate-500",
};

export function BidDecisionCard({
  tenderId,
  decision,
  canRun,
  canDecide,
}: {
  tenderId: string;
  decision: BidDecisionData | null;
  canRun: boolean; // WRITER+
  canDecide: boolean; // MANAGER+
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState("");
  const [deciding, startDecide] = useTransition();
  const { run, isRunning, state } = useAIJob({
    onComplete: () => {
      toast({ title: "Bid analysis ready" });
      router.refresh();
    },
    onError: (e) => toast({ title: "Analysis failed", description: e, variant: "destructive" }),
  });

  function analyze() {
    void run(() =>
      fetch("/api/ai/bid-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenderId }),
      })
    );
  }

  function decide(d: "BID" | "NO_BID") {
    startDecide(async () => {
      const res = await recordBidDecision({ tenderId, decision: d, notes: notes.trim() || undefined });
      if (!res.success) {
        toast({ title: "Could not record decision", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: d === "BID" ? "Decision recorded: Bid" : "Decision recorded: No-bid" });
      router.refresh();
    });
  }

  // ── No analysis yet ───────────────────────────────────────────────────────
  if (!decision) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-2 flex items-center gap-2">
          <Scale className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Bid / No-Bid</h3>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-slate-500">
          Score this tender against your company profile and win history — factor math plus an AI
          assessment of risks and what to clarify first.
        </p>
        {canRun ? (
          <Button size="sm" className="w-full" onClick={analyze} disabled={isRunning}>
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isRunning ? `Analyzing… ${state.progress}%` : "Run analysis (1 credit)"}
          </Button>
        ) : (
          <p className="text-xs text-slate-400">A Writer or above can run the analysis.</p>
        )}
      </div>
    );
  }

  const meta = REC_META[decision.recommendation];
  const pct = Math.round(decision.score * 100);
  const decided = decision.humanDecision != null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Bid / No-Bid</h3>
        </div>
        {canRun && (
          <button
            type="button"
            onClick={analyze}
            disabled={isRunning}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            title="Re-run analysis (1 credit)"
          >
            {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {/* Score + recommendation */}
      <div className="mb-3 flex items-center gap-3">
        <div className="relative h-16 w-16 shrink-0">
          <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="3.5" />
            <circle
              cx="18" cy="18" r="15.5" fill="none"
              className={cn("transition-all", meta.ring)}
              stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * 97.4} 97.4`}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-900 dark:text-white">
            {pct}%
          </span>
        </div>
        <div className="min-w-0">
          <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", meta.cls)}>
            {meta.label}
          </span>
          <p className="mt-1 text-[11px] leading-tight text-slate-400">
            Factors {Math.round(decision.baseScore * 100)}%
            {decision.llmAdjustment !== 0 &&
              ` · AI ${decision.llmAdjustment > 0 ? "+" : ""}${Math.round(decision.llmAdjustment * 100)}%`}
            {" · "}confidence {Math.round(decision.confidence * 100)}%
          </p>
        </div>
      </div>

      {/* Factor bars */}
      <div className="mb-3 space-y-1.5">
        {Object.entries(decision.factors).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-[11px] text-slate-500">{FACTOR_LABELS[k] ?? k}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={cn(
                  "h-full rounded-full",
                  v >= 0.7 ? "bg-emerald-500" : v >= 0.4 ? "bg-amber-500" : "bg-red-500"
                )}
                style={{ width: `${Math.round(v * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Rationale + risks (collapsible) */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="mb-2 flex w-full items-center justify-between text-xs font-medium text-blue-600 hover:text-blue-700"
      >
        {expanded ? "Hide assessment" : "Read full assessment"}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="mb-3 space-y-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed dark:bg-slate-800/50">
          <p className="text-slate-600 dark:text-slate-300">{decision.rationale}</p>
          {decision.rationaleAr && (
            <p dir="rtl" className="border-t border-slate-200 pt-2 text-slate-600 dark:border-slate-700 dark:text-slate-300" style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}>
              {decision.rationaleAr}
            </p>
          )}
          {decision.risks.length > 0 && (
            <div>
              <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">Risks</p>
              <ul className="space-y-1">
                {decision.risks.map((r, i) => (
                  <li key={i} className="flex gap-1.5">
                    <AlertTriangle className={cn("mt-0.5 h-3 w-3 shrink-0", RISK_CLS[r.severity])} />
                    <span className="text-slate-600 dark:text-slate-300">
                      <span className="font-medium">{r.title}.</span> {r.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {decision.questionsToAsk.length > 0 && (
            <div>
              <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">Clarify before committing</p>
              <ul className="space-y-1">
                {decision.questionsToAsk.map((q, i) => (
                  <li key={i} className="flex gap-1.5">
                    <HelpCircle className="mt-0.5 h-3 w-3 shrink-0 text-blue-500" />
                    <span className="text-slate-600 dark:text-slate-300">{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Human decision */}
      {decided ? (
        <div
          className={cn(
            "flex items-start gap-2 rounded-lg p-2.5 text-xs",
            decision.humanDecision === "BID"
              ? "bg-emerald-50 dark:bg-emerald-950/30"
              : "bg-red-50 dark:bg-red-950/30"
          )}
        >
          {decision.humanDecision === "BID" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          )}
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-100">
              Decision: {decision.humanDecision === "BID" ? "Bid" : "No-bid"}
            </p>
            <p className="text-slate-500">
              {decision.decidedByName ?? "—"}
              {decision.decidedAt && ` · ${new Date(decision.decidedAt).toLocaleDateString()}`}
            </p>
            {decision.decisionNotes && <p className="mt-1 text-slate-500">{decision.decisionNotes}</p>}
          </div>
        </div>
      ) : canDecide ? (
        <div className="space-y-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Decision notes (optional)…"
            rows={2}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={() => decide("BID")} disabled={deciding}>
              <ThumbsUp className="h-3.5 w-3.5" /> Bid
            </Button>
            <Button size="sm" variant="outline" className="flex-1 text-red-600 hover:text-red-700" onClick={() => decide("NO_BID")} disabled={deciding}>
              <ThumbsDown className="h-3.5 w-3.5" /> No-bid
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-slate-400">A Manager or above records the final decision.</p>
      )}
    </div>
  );
}
