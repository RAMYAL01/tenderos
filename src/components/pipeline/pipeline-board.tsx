"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal, Compass, FileSearch, Hammer, Send, Flag, Trophy,
  CalendarClock, Scale, ArrowRight, Loader2,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { RecordOutcomeDialog } from "@/components/tenders/record-outcome-dialog";
import { moveTenderStage } from "@/lib/actions/pipeline";
import type { PipelineData, PipelineCard } from "@/lib/data/pipeline";

type Stage = "DRAFT" | "ACTIVE" | "SUBMITTED";

const STAGES: { key: Stage; label: string }[] = [
  { key: "DRAFT", label: "Qualifying" },
  { key: "ACTIVE", label: "Bidding" },
  { key: "SUBMITTED", label: "Submitted" },
];

const OUTCOME_BADGE: Record<string, string> = {
  WON: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  LOST: "bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-300",
  NO_DECISION: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  CANCELLED: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

function deadlineChip(iso: string | null): { text: string; cls: string } | null {
  if (!iso) return null;
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { text: "Past deadline", cls: "text-slate-400" };
  if (days <= 3) return { text: `${days}d left`, cls: "text-red-600 font-semibold" };
  if (days <= 10) return { text: `${days}d left`, cls: "text-amber-600 font-medium" };
  return { text: `${days}d left`, cls: "text-slate-500" };
}

function bidPill(bid: PipelineCard["bid"]): { text: string; cls: string } | null {
  if (!bid) return null;
  const pct = Math.round(bid.score * 100);
  if (bid.humanDecision === "BID") return { text: `Bid · ${pct}%`, cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" };
  if (bid.humanDecision === "NO_BID") return { text: `No-bid · ${pct}%`, cls: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300" };
  if (bid.recommendation === "BID") return { text: `${pct}% fit`, cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" };
  if (bid.recommendation === "NO_BID") return { text: `${pct}% fit`, cls: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300" };
  return { text: `${pct}% fit`, cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" };
}

export function PipelineBoard({
  data,
  canMove,
  canDecide,
}: {
  data: PipelineData;
  canMove: boolean; // WRITER+
  canDecide: boolean; // MANAGER+ (record outcome)
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [movingId, setMovingId] = useState<string | null>(null);
  const [outcomeFor, setOutcomeFor] = useState<{ id: string; status: string } | null>(null);

  function move(card: PipelineCard, stage: Stage) {
    setMovingId(card.id);
    start(async () => {
      const res = await moveTenderStage({ tenderId: card.id, stage });
      setMovingId(null);
      if (!res.success) {
        toast({ title: "Couldn't move tender", description: res.error, variant: "destructive" });
        return;
      }
      router.refresh();
    });
  }

  function Card({ card, currentStage }: { card: PipelineCard; currentStage: Stage | "CLOSED" }) {
    const chip = deadlineChip(card.submissionDeadline);
    const pill = bidPill(card.bid);
    const busy = pending && movingId === card.id;

    return (
      <div className="group rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/tenders/${card.id}`}
            className="min-w-0 flex-1 text-sm font-medium leading-snug text-slate-900 hover:text-blue-600 dark:text-white"
          >
            <span className="line-clamp-2">{card.titleEn}</span>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-md p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 group-hover:opacity-100 dark:hover:bg-slate-800"
                aria-label="Tender actions"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href={`/tenders/${card.id}`}>Open tender</Link>
              </DropdownMenuItem>
              {canMove && (
                <>
                  <DropdownMenuSeparator />
                  {STAGES.filter((s) => s.key !== currentStage).map((s) => (
                    <DropdownMenuItem key={s.key} onClick={() => move(card, s.key)}>
                      {/* Reopening a closed tender clears its recorded outcome —
                          say so, so the move is informed (verification finding). */}
                      {currentStage === "CLOSED"
                        ? `Reopen to ${s.label} (clears outcome)`
                        : `Move to ${s.label}`}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              {canDecide && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setOutcomeFor({ id: card.id, status: card.status })}>
                    <Trophy className="h-3.5 w-3.5" />
                    {currentStage === "CLOSED" ? "Edit outcome…" : "Record outcome…"}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {card.clientName && (
          <p className="mt-0.5 truncate text-xs text-slate-500">{card.clientName}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          {currentStage === "CLOSED" && (
            <span className={cn("rounded-full px-2 py-0.5 font-semibold", OUTCOME_BADGE[card.status])}>
              {card.status.replace("_", " ")}
            </span>
          )}
          {pill && (
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold", pill.cls)}>
              <Scale className="h-3 w-3" /> {pill.text}
            </span>
          )}
          {card.estimatedValue != null && (
            <span className="font-medium text-slate-600 dark:text-slate-300">
              {formatCurrency(card.estimatedValue, card.currency)}
            </span>
          )}
          {chip && currentStage !== "CLOSED" && (
            <span className={cn("inline-flex items-center gap-1", chip.cls)}>
              <CalendarClock className="h-3 w-3" /> {chip.text}
            </span>
          )}
        </div>
      </div>
    );
  }

  function Column({
    title,
    icon: Icon,
    cards,
    stage,
    accent,
  }: {
    title: string;
    icon: React.ElementType;
    cards: PipelineCard[];
    stage: Stage | "CLOSED";
    accent: string;
  }) {
    return (
      <div className="flex w-72 shrink-0 flex-col">
        <div className="mb-3 flex items-center gap-2">
          <span className={cn("flex h-6 w-6 items-center justify-center rounded-md", accent)}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {cards.length}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {cards.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400 dark:border-slate-800">
              Empty
            </div>
          ) : (
            cards.map((c) => <Card key={c.id} card={c} currentStage={stage} />)
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex gap-4 overflow-x-auto pb-4">
        {/* Discovered rail — saved opportunities not yet converted */}
        <div className="flex w-72 shrink-0 flex-col">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950">
              <Compass className="h-3.5 w-3.5" />
            </span>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Discovered</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {data.discovered.length}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {data.discovered.length === 0 ? (
              <Link
                href="/discover"
                className="rounded-xl border border-dashed border-blue-200 py-8 text-center text-xs text-blue-600 transition-colors hover:bg-blue-50/50 dark:border-blue-900 dark:hover:bg-blue-950/30"
              >
                Browse matched tenders →
              </Link>
            ) : (
              data.discovered.map((d) => (
                <Link
                  key={d.matchId}
                  href="/discover"
                  className="group rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3 transition-colors hover:border-blue-400 hover:bg-blue-50/40 dark:border-slate-700 dark:bg-slate-900/40"
                >
                  <p className="line-clamp-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                    {d.titleEn}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="truncate">{d.buyerName ?? "—"}</span>
                    <span className="ml-2 inline-flex shrink-0 items-center gap-1 font-semibold text-blue-600">
                      {Math.round(d.relevanceScore * 100)}% <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <Column title="Qualifying" icon={FileSearch} cards={data.qualifying} stage="DRAFT" accent="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" />
        <Column title="Bidding" icon={Hammer} cards={data.bidding} stage="ACTIVE" accent="bg-blue-50 text-blue-600 dark:bg-blue-950" />
        <Column title="Submitted" icon={Send} cards={data.submitted} stage="SUBMITTED" accent="bg-violet-50 text-violet-600 dark:bg-violet-950" />
        <Column title="Closed" icon={Flag} cards={data.closed} stage="CLOSED" accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-950" />
      </div>

      {/* Shared, board-driven outcome dialog */}
      {outcomeFor && (
        <RecordOutcomeDialog
          tenderId={outcomeFor.id}
          currentStatus={outcomeFor.status}
          open
          onOpenChange={(o) => {
            if (!o) setOutcomeFor(null);
          }}
        />
      )}
    </div>
  );
}

export function PipelineSummary({ data }: { data: PipelineData }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-500">
      <span className="font-semibold text-slate-900 dark:text-white">
        {formatCurrency(data.totals.activeValue, data.totals.currency)}
      </span>
      live pipeline · {data.bidding.length + data.submitted.length} active bids
    </div>
  );
}
