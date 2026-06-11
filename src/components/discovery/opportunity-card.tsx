"use client";

import Link from "next/link";
import {
  Globe, CalendarClock, Building2, Bookmark, X, ArrowRight, Check, Loader2, ExternalLink,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { DiscoverItem } from "@/lib/data/opportunities";

const SECTOR_LABEL: Record<string, string> = {
  construction: "Construction", infrastructure: "Infrastructure", facilities: "Facilities",
  oil_gas: "Oil & Gas", water: "Water", energy: "Energy", consulting: "Consulting",
};

function matchTone(score: number): { label: string; rail: string; pill: string } {
  if (score >= 0.6) return { label: "Strong match", rail: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" };
  if (score >= 0.35) return { label: "Good match", rail: "bg-amber-500", pill: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" };
  return { label: "Possible match", rail: "bg-slate-400", pill: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" };
}

function closing(date: Date | null): { text: string; cls: string } | null {
  if (!date) return null;
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { text: "Closed", cls: "text-slate-400" };
  if (days === 0) return { text: "Closes today", cls: "text-red-600 font-medium" };
  if (days <= 7) return { text: `Closes in ${days}d`, cls: "text-red-600 font-medium" };
  if (days <= 21) return { text: `Closes in ${days}d`, cls: "text-amber-600" };
  return { text: `Closes in ${days}d`, cls: "text-slate-500" };
}

export function OpportunityCard({
  item, pending, onConvert, onSave, onDismiss,
}: {
  item: DiscoverItem;
  pending: boolean;
  onConvert: (id: string) => void;
  onSave: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const tone = matchTone(item.relevanceScore);
  const close = closing(item.closingDate);
  const pct = Math.round(item.relevanceScore * 100);
  const converted = item.trackingStatus === "CONVERTED";
  const saved = item.trackingStatus === "SAVED";

  return (
    <div className="group relative flex gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <span className={cn("absolute inset-y-0 left-0 w-1", tone.rail)} aria-hidden />

      <div className="min-w-0 flex-1 pl-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-slate-900 dark:text-white">{item.titleEn}</h3>
            {item.titleAr && (
              <p className="truncate text-sm text-slate-500" dir="rtl" style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}>
                {item.titleAr}
              </p>
            )}
          </div>
          <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", tone.pill)}>
            {pct}% · {tone.label}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
          {item.buyerName && (
            <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{item.buyerName}</span>
          )}
          {item.country && <span className="inline-flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />{item.country}</span>}
          {item.sector && <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{SECTOR_LABEL[item.sector] ?? item.sector}</span>}
          {item.estimatedValue != null && (
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {formatCurrency(item.estimatedValue, item.currency ?? "USD")}
            </span>
          )}
          {close && <span className={cn("inline-flex items-center gap-1.5", close.cls)}><CalendarClock className="h-3.5 w-3.5" />{close.text}</span>}
        </div>

        <div className="mt-4 flex items-center gap-2">
          {converted ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/tenders/${item.convertedTenderId}`}>
                <Check className="h-4 w-4 text-emerald-600" /> View tender
              </Link>
            </Button>
          ) : (
            <Button size="sm" onClick={() => onConvert(item.matchId)} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Convert to tender
            </Button>
          )}

          {!converted && (
            <Button size="sm" variant="ghost" onClick={() => onSave(item.opportunityId)} disabled={pending || saved}>
              <Bookmark className={cn("h-4 w-4", saved && "fill-current text-blue-600")} />
              {saved ? "Saved" : "Save"}
            </Button>
          )}

          {item.sourceUrl && (
            <Button asChild size="sm" variant="ghost">
              <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Source</a>
            </Button>
          )}

          <Button size="icon" variant="ghost" className="ml-auto h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => onDismiss(item.matchId)} disabled={pending} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
