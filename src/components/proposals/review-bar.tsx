"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Send, CheckCircle2, Undo2, MessageSquareWarning, Loader2, History, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  submitProposalForReview,
  approveProposal,
  requestProposalChanges,
  reopenProposal,
} from "@/lib/actions/proposal-review";

export interface ReviewTrailItem {
  id: string;
  action: "SUBMITTED" | "APPROVED" | "CHANGES_REQUESTED" | "REOPENED";
  note: string | null;
  actorName: string;
  at: string; // ISO
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  IN_REVIEW: { label: "In review", cls: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300" },
  CHANGES_REQUESTED: { label: "Changes requested", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
  APPROVED: { label: "Approved", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
  EXPORTED: { label: "Exported", cls: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" },
  ARCHIVED: { label: "Archived", cls: "bg-slate-100 text-slate-400 dark:bg-slate-800" },
};

const ACTION_LABEL: Record<ReviewTrailItem["action"], string> = {
  SUBMITTED: "submitted for review",
  APPROVED: "approved",
  CHANGES_REQUESTED: "requested changes",
  REOPENED: "reopened",
};

export function ReviewBar({
  proposalId,
  status,
  trail,
  canSubmit, // WRITER+
  canReview, // MANAGER+
}: {
  proposalId: string;
  status: string;
  trail: ReviewTrailItem[];
  canSubmit: boolean;
  canReview: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showChanges, setShowChanges] = useState(false);
  const [showTrail, setShowTrail] = useState(false);
  const [note, setNote] = useState("");

  const meta = STATUS_META[status] ?? STATUS_META.DRAFT;
  const lastChangeRequest = trail.find((t) => t.action === "CHANGES_REQUESTED");

  function run(fn: () => Promise<{ success: boolean; error?: string }>, okMsg: string) {
    start(async () => {
      const res = await fn();
      if (!res.success) {
        toast({ title: "Action failed", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: okMsg });
      setShowChanges(false);
      setNote("");
      router.refresh();
    });
  }

  return (
    <div className="border-b border-slate-200 bg-white/90 px-6 py-2.5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", meta.cls)}>
          {meta.label}
        </span>

        {/* The reviewer's note is the writer's to-do — keep it in their face. */}
        {status === "CHANGES_REQUESTED" && lastChangeRequest?.note && (
          <span className="inline-flex max-w-md items-center gap-1.5 truncate text-xs text-amber-700 dark:text-amber-300">
            <MessageSquareWarning className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {lastChangeRequest.actorName}: “{lastChangeRequest.note}”
            </span>
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Trail toggle */}
          {trail.length > 0 && (
            <button
              type="button"
              onClick={() => setShowTrail((s) => !s)}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <History className="h-3.5 w-3.5" />
              Trail
              <ChevronDown className={cn("h-3 w-3 transition-transform", showTrail && "rotate-180")} />
            </button>
          )}

          {/* Contextual gate actions */}
          {(status === "DRAFT" || status === "CHANGES_REQUESTED") && canSubmit && (
            <Button size="sm" disabled={pending} onClick={() => run(() => submitProposalForReview(proposalId), "Submitted for review")}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit for review
            </Button>
          )}

          {status === "IN_REVIEW" && canReview && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-amber-700 hover:text-amber-800"
                disabled={pending}
                onClick={() => setShowChanges((s) => !s)}
              >
                <MessageSquareWarning className="h-4 w-4" />
                Request changes
              </Button>
              <Button size="sm" disabled={pending} onClick={() => run(() => approveProposal(proposalId), "Proposal approved")}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Approve
              </Button>
            </>
          )}

          {status === "IN_REVIEW" && !canReview && (
            <span className="text-xs text-slate-400">Awaiting manager review</span>
          )}

          {status === "APPROVED" && canReview && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => reopenProposal(proposalId), "Reopened as draft")}>
              <Undo2 className="h-4 w-4" />
              Reopen
            </Button>
          )}
        </div>
      </div>

      {/* Request-changes note */}
      {showChanges && (
        <div className="mt-2 flex items-start gap-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="What needs to change? (required — the writer sees this)"
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 text-amber-700"
            disabled={pending || note.trim().length < 3}
            onClick={() => run(() => requestProposalChanges(proposalId, note), "Sent back with feedback")}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send back
          </Button>
        </div>
      )}

      {/* Approval trail */}
      {showTrail && trail.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 dark:border-slate-800">
          {trail.map((t) => (
            <li key={t.id} className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-700 dark:text-slate-200">{t.actorName}</span>{" "}
              {ACTION_LABEL[t.action]}
              {t.note && <span className="text-slate-400"> — “{t.note}”</span>}{" "}
              <span className="text-slate-400">· {new Date(t.at).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
