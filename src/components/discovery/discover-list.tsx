"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, Loader2, BellRing, BellOff, BookmarkPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import type { DiscoverItem } from "@/lib/data/opportunities";
import type { SavedSearchItem } from "@/lib/data/saved-searches";
import { OpportunityCard } from "./opportunity-card";
import {
  convertOpportunityToTender,
  trackOpportunity,
  dismissOpportunity,
  scanForOpportunities,
  createSavedSearch,
  deleteSavedSearch,
  toggleSavedSearchAlerts,
} from "@/lib/actions/opportunities";

type FilterKey = "all" | "strong" | "closing" | "saved";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "strong", label: "Strong matches" },
  { key: "closing", label: "Closing soon" },
  { key: "saved", label: "Saved" },
];

function isClosingSoon(d: Date | null): boolean {
  if (!d) return false;
  const days = (new Date(d).getTime() - Date.now()) / 86_400_000;
  return days >= 0 && days <= 7;
}

export function DiscoverList({
  items,
  savedSearches = [],
  canScheduleAlerts = false,
}: {
  items: DiscoverItem[];
  savedSearches?: SavedSearchItem[];
  canScheduleAlerts?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [savingSearch, setSavingSearch] = useState(false);

  const counts = useMemo(
    () => ({
      all: items.length,
      strong: items.filter((i) => i.relevanceScore >= 0.6).length,
      closing: items.filter((i) => isClosingSoon(i.closingDate)).length,
      saved: items.filter((i) => i.trackingStatus === "SAVED").length,
    }),
    [items]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (filter === "strong" && i.relevanceScore < 0.6) return false;
      if (filter === "closing" && !isClosingSoon(i.closingDate)) return false;
      if (filter === "saved" && i.trackingStatus !== "SAVED") return false;
      if (q) {
        const hay = `${i.titleEn} ${i.titleAr ?? ""} ${i.buyerName ?? ""} ${i.sector ?? ""} ${i.country ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, query, filter]);

  function run(id: string, fn: () => Promise<{ success: boolean; error?: string; tenderId?: string }>, opts?: { redirectToTender?: boolean }) {
    setPendingId(id);
    start(async () => {
      const res = await fn();
      setPendingId(null);
      if (!res.success) {
        toast({ title: "Action failed", description: res.error, variant: "destructive" });
        return;
      }
      if (opts?.redirectToTender && res.tenderId) {
        router.push(`/tenders/${res.tenderId}`);
        return;
      }
      router.refresh();
    });
  }

  function rescan() {
    setPendingId("__scan__");
    start(async () => {
      const res = await scanForOpportunities();
      setPendingId(null);
      if (!res.success) {
        toast({ title: "Couldn't refresh", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: "Matches refreshed", description: `${res.matched} ranked for your company.` });
      router.refresh();
    });
  }

  function saveCurrentSearch() {
    const name =
      query.trim() ||
      (filter !== "all" ? FILTERS.find((f) => f.key === filter)?.label : "") ||
      "All opportunities";
    setSavingSearch(true);
    start(async () => {
      const res = await createSavedSearch({
        name: name.slice(0, 80),
        filters: { query: query.trim(), filter },
        alertsEnabled: canScheduleAlerts, // on by default where the tier allows
      });
      setSavingSearch(false);
      if (!res.success) {
        toast({ title: "Couldn't save search", description: res.error, variant: "destructive" });
        return;
      }
      toast({
        title: "Search saved",
        description: canScheduleAlerts
          ? "You'll get a daily digest when new matches arrive."
          : "Saved. Upgrade to Professional for daily alert digests.",
      });
      router.refresh();
    });
  }

  function applySaved(s: SavedSearchItem) {
    setQuery(s.filters.query ?? "");
    const f = s.filters.filter as FilterKey | undefined;
    setFilter(f && FILTERS.some((x) => x.key === f) ? f : "all");
  }

  function removeSaved(id: string) {
    start(async () => {
      const res = await deleteSavedSearch(id);
      if (!res.success) toast({ title: "Couldn't delete", description: res.error, variant: "destructive" });
      router.refresh();
    });
  }

  function toggleAlerts(s: SavedSearchItem) {
    start(async () => {
      const res = await toggleSavedSearchAlerts(s.id, !s.alertsEnabled);
      if (!res.success) {
        toast({ title: "Couldn't update alerts", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: s.alertsEnabled ? "Daily digest off" : "Daily digest on", description: s.name });
      router.refresh();
    });
  }

  return (
    <div className="p-6">
      {/* Controls */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                filter === f.key
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              )}
            >
              {f.label}
              <span className="ml-1.5 text-xs opacity-70">{counts[f.key]}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search opportunities…"
              className="h-9 w-56 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <Button variant="outline" size="sm" onClick={saveCurrentSearch} disabled={pending || savingSearch}>
            {savingSearch ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />}
            Save search
          </Button>
          <Button variant="outline" size="sm" onClick={rescan} disabled={pending}>
            {pendingId === "__scan__" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* Saved monitors */}
      {savedSearches.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Monitors</span>
          {savedSearches.map((s) => (
            <span
              key={s.id}
              className="group inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white py-1 pl-3 pr-1 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <button type="button" onClick={() => applySaved(s)} className="hover:text-blue-600" title="Apply this search">
                {s.name}
              </button>
              <button
                type="button"
                onClick={() => toggleAlerts(s)}
                disabled={pending}
                className={cn(
                  "rounded-full p-1 transition-colors",
                  s.alertsEnabled ? "text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950" : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
                title={s.alertsEnabled ? "Daily digest on — click to disable" : "Daily digest off — click to enable"}
              >
                {s.alertsEnabled ? <BellRing className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => removeSaved(s.id)}
                disabled={pending}
                className="rounded-full p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                title="Delete monitor"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-20 text-center dark:border-slate-800">
          <p className="text-sm text-slate-500">No opportunities match your filters.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((item) => (
            <OpportunityCard
              key={item.matchId}
              item={item}
              pending={pending && (pendingId === item.matchId || pendingId === item.opportunityId)}
              onConvert={(id) => run(id, () => convertOpportunityToTender(id), { redirectToTender: true })}
              onSave={(id) => run(id, () => trackOpportunity(id))}
              onDismiss={(id) => run(id, () => dismissOpportunity(id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
