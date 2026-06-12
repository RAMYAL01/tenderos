"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trophy, XCircle, MinusCircle, Ban, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { recordTenderOutcome } from "@/lib/actions/outcomes";

type OutcomeStatus = "WON" | "LOST" | "NO_DECISION" | "CANCELLED";

const OUTCOMES: { value: OutcomeStatus; label: string; icon: typeof Trophy; cls: string; active: string }[] = [
  { value: "WON", label: "Won", icon: Trophy, cls: "text-emerald-600", active: "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" },
  { value: "LOST", label: "Lost", icon: XCircle, cls: "text-red-600", active: "border-red-500 bg-red-50 dark:bg-red-950/30" },
  { value: "NO_DECISION", label: "No decision", icon: MinusCircle, cls: "text-amber-600", active: "border-amber-500 bg-amber-50 dark:bg-amber-950/30" },
  { value: "CANCELLED", label: "Cancelled", icon: Ban, cls: "text-slate-500", active: "border-slate-400 bg-slate-50 dark:bg-slate-800/50" },
];

const LOSS_REASONS = [
  { value: "PRICE", label: "Price — outbid on cost" },
  { value: "TECHNICAL_SCORE", label: "Technical score" },
  { value: "LOCAL_CONTENT", label: "Local content / ICV" },
  { value: "LATE_SUBMISSION", label: "Late submission" },
  { value: "INCOMPLETE_SUBMISSION", label: "Incomplete submission" },
  { value: "DISQUALIFIED", label: "Disqualified" },
  { value: "NO_BID", label: "Withdrew / didn't bid" },
  { value: "OTHER", label: "Other" },
] as const;

export function RecordOutcomeDialog({
  tenderId,
  currentStatus,
  trigger,
}: {
  tenderId: string;
  currentStatus: string;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const isEdit = ["WON", "LOST", "NO_DECISION", "CANCELLED"].includes(currentStatus);

  const [status, setStatus] = useState<OutcomeStatus | null>(
    isEdit ? (currentStatus as OutcomeStatus) : null
  );
  const [lossReason, setLossReason] = useState<string>("");
  const [awardedValue, setAwardedValue] = useState<string>("");
  const [winningCompetitor, setWinningCompetitor] = useState("");
  const [notes, setNotes] = useState("");

  function submit() {
    if (!status) {
      toast({ title: "Pick an outcome", variant: "destructive" });
      return;
    }
    if (status === "LOST" && !lossReason) {
      toast({ title: "Select why it was lost", description: "Loss reasons power your win/loss intelligence.", variant: "destructive" });
      return;
    }
    const parsedValue = awardedValue.trim() ? Number(awardedValue.replace(/,/g, "")) : undefined;
    if (parsedValue !== undefined && (!Number.isFinite(parsedValue) || parsedValue < 0)) {
      toast({ title: "Awarded value must be a number", variant: "destructive" });
      return;
    }

    start(async () => {
      const res = await recordTenderOutcome({
        tenderId,
        status,
        lossReason: status === "LOST" ? (lossReason as (typeof LOSS_REASONS)[number]["value"]) : undefined,
        awardedValue: status === "WON" ? parsedValue : undefined,
        winningCompetitor: status === "LOST" ? winningCompetitor.trim() || undefined : undefined,
        notes: notes.trim() || undefined,
      });
      if (!res.success) {
        toast({ title: "Could not record outcome", description: res.error, variant: "destructive" });
        return;
      }
      toast({
        title: status === "WON" ? "Recorded: Won 🏆" : "Outcome recorded",
        description: "Your matching and bid scoring just got smarter.",
      });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant={isEdit ? "outline" : "default"}>
            <Trophy className="h-4 w-4" />
            {isEdit ? "Edit outcome" : "Record outcome"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bid outcome</DialogTitle>
          <DialogDescription>
            The debrief feeds your win/loss intelligence — every outcome sharpens
            opportunity matching and bid scoring.
          </DialogDescription>
        </DialogHeader>

        {/* Outcome picker */}
        <div className="grid grid-cols-2 gap-2">
          {OUTCOMES.map((o) => {
            const Icon = o.icon;
            const active = status === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => setStatus(o.value)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? o.active
                    : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                )}
              >
                <Icon className={cn("h-4 w-4", o.cls)} />
                <span className="text-slate-800 dark:text-slate-100">{o.label}</span>
              </button>
            );
          })}
        </div>

        {/* WON: actual award value */}
        {status === "WON" && (
          <div>
            <Label htmlFor="awardedValue">Awarded contract value (optional)</Label>
            <Input
              id="awardedValue"
              inputMode="decimal"
              value={awardedValue}
              onChange={(e) => setAwardedValue(e.target.value)}
              placeholder="e.g. 240000000"
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-slate-400">
              The actual value — used for revenue analytics instead of the estimate.
            </p>
          </div>
        )}

        {/* LOST: reason + competitor */}
        {status === "LOST" && (
          <>
            <div>
              <Label htmlFor="lossReason">Why was it lost? *</Label>
              <select
                id="lossReason"
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="">Select reason…</option>
                {LOSS_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="winningCompetitor">Who won? (optional)</Label>
              <Input
                id="winningCompetitor"
                value={winningCompetitor}
                onChange={(e) => setWinningCompetitor(e.target.value)}
                placeholder="Competitor name"
                className="mt-1.5"
              />
            </div>
          </>
        )}

        <div>
          <Label htmlFor="outcomeNotes">Debrief notes (optional)</Label>
          <textarea
            id="outcomeNotes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="What did we learn? What would we do differently?"
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>

        <Button onClick={submit} disabled={pending || !status} className="w-full">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
          Save outcome
        </Button>
      </DialogContent>
    </Dialog>
  );
}
