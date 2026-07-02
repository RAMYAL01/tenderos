import Link from "next/link";
import { ArrowLeft, Building2, CalendarClock, Globe2, Layers, TrendingUp, Sparkles, BarChart3, Trophy, Lock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { getMarketIntelligence } from "@/lib/data/market";
import { getAuthContext } from "@/lib/auth";
import { canReadBenchmarks, getBenchmarkOverview, OVERVIEW_MIN } from "@/lib/benchmark/read";

export const metadata = { title: "Market intelligence" };
export const dynamic = "force-dynamic";

const COUNTRY_NAME: Record<string, string> = {
  EG: "Egypt", MA: "Morocco", TN: "Tunisia", DZ: "Algeria", LY: "Libya", DJ: "Djibouti",
  MR: "Mauritania", SD: "Sudan", JO: "Jordan", LB: "Lebanon", IQ: "Iraq", PS: "Palestine",
  SA: "Saudi Arabia", AE: "UAE", QA: "Qatar", KW: "Kuwait", OM: "Oman", BH: "Bahrain", YE: "Yemen",
};
const SECTOR_LABEL: Record<string, string> = {
  construction: "Construction", infrastructure: "Infrastructure", facilities: "Facilities",
  oil_gas: "Oil & Gas", consulting: "Consulting", services: "Services", supply: "Supply",
  it: "IT", other: "Other",
};

function Bar({ label, count, max, tone }: { label: string; count: number; max: number; tone: string }) {
  const pct = max > 0 ? Math.max(6, Math.round((count / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate text-sm text-slate-600 dark:text-slate-300">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums text-slate-700 dark:text-slate-200">
        {count}
      </span>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Globe2; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
        <Icon className="h-4 w-4 text-slate-400" /> {title}
      </h3>
      {children}
    </section>
  );
}

export default async function MarketInsightsPage() {
  const m = await getMarketIntelligence();
  const maxCountry = m.byCountry[0]?.count ?? 0;
  const maxSector = m.bySector[0]?.count ?? 0;
  const maxBuyer = m.topBuyers[0]?.count ?? 0;

  const { org } = await getAuthContext();
  const canBenchmark = canReadBenchmarks(org.planTier);
  const overview = canBenchmark ? await getBenchmarkOverview() : null;

  return (
    <>
      <PageHeader title="Market intelligence" description="Live demand signals across the tender market.">
        <Button asChild variant="outline" size="sm">
          <Link href="/discover"><ArrowLeft className="h-4 w-4" /> Back to feed</Link>
        </Button>
      </PageHeader>

      <div className="mx-auto max-w-5xl space-y-6 p-6">
        {/* ── Award benchmarks (cross-customer pool, k-anonymized) ─────── */}
        <section className="rounded-2xl border border-blue-200/70 bg-gradient-to-br from-blue-50/70 to-white p-5 dark:border-blue-900/40 dark:from-blue-950/25 dark:to-slate-900">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Award benchmarks</h3>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              Pooled · anonymized
            </span>
            <span className="ml-auto hidden text-xs text-slate-400 sm:inline">who wins, where, at what value</span>
          </div>

          {!canBenchmark ? (
            <div className="flex flex-col items-center gap-2 rounded-xl bg-white/70 px-4 py-8 text-center dark:bg-slate-900/50">
              <Lock className="h-5 w-5 text-slate-400" />
              <p className="max-w-md text-sm text-slate-600 dark:text-slate-300">
                See who wins across the market — award volumes by sector and region, and the most active winning firms —
                pooled and anonymized across every TenderOS workspace and public gazettes.
              </p>
              <Link
                href="/settings/billing"
                className="mt-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Upgrade to unlock
              </Link>
            </div>
          ) : !overview || overview.totalAwards < OVERVIEW_MIN ? (
            <p className="rounded-xl bg-white/70 px-4 py-6 text-sm text-slate-500 dark:bg-slate-900/50">
              Pooling award data{overview && overview.totalAwards > 0 ? ` — ${overview.totalAwards} so far` : ""}. Market
              benchmarks unlock as awards accumulate across the network and public gazettes. Every debrief you record on a
              won or lost bid strengthens the pool.
            </p>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { v: overview.totalAwards, l: "Pooled awards" },
                  { v: overview.fromGazette, l: "From public gazettes" },
                  { v: overview.fromNetwork, l: "From the network" },
                ].map((s) => (
                  <div key={s.l} className="rounded-xl bg-white px-3 py-2.5 dark:bg-slate-900">
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{s.v}</p>
                    <p className="text-[11px] text-slate-500">{s.l}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <h4 className="mb-2.5 text-xs font-medium text-slate-600 dark:text-slate-300">Awards by sector</h4>
                  <div className="space-y-2.5">
                    {overview.bySector.slice(0, 8).map((s) => (
                      <Bar key={s.sector} label={SECTOR_LABEL[s.sector] ?? s.sector} count={s.count} max={overview.bySector[0]?.count ?? 0} tone="bg-blue-500" />
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="mb-2.5 text-xs font-medium text-slate-600 dark:text-slate-300">Awards by region</h4>
                  <div className="space-y-2.5">
                    {overview.byCountry.slice(0, 8).map((c) => (
                      <Bar key={c.country} label={COUNTRY_NAME[c.country] ?? c.country} count={c.count} max={overview.byCountry[0]?.count ?? 0} tone="bg-emerald-500" />
                    ))}
                  </div>
                </div>
              </div>

              {overview.topWinners.length > 0 && (
                <div>
                  <h4 className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                    <Trophy className="h-3.5 w-3.5 text-amber-500" /> Most active winners
                  </h4>
                  <ol className="grid gap-1.5 sm:grid-cols-2">
                    {overview.topWinners.map((w, i) => (
                      <li key={w.name} className="flex items-center gap-2.5 rounded-lg bg-white px-3 py-1.5 text-sm dark:bg-slate-900">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500 dark:bg-slate-800">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200" title={w.name}>{w.name}</span>
                        <span className="shrink-0 tabular-nums text-slate-400">{w.count}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <p className="text-[10px] text-slate-400">
                Based on {overview.totalAwards} pooled awards across the market · anonymized (firms shown have won ≥3).
              </p>
            </div>
          )}
        </section>

        {/* Market activity */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: "Open tenders", value: m.activity.open, tone: "text-blue-600" },
            { label: "Closing soon", value: m.activity.closingSoon, tone: "text-amber-600" },
            { label: "New this week", value: m.activity.newLast7d, tone: "text-emerald-600" },
            { label: "Countries", value: m.activity.countries, tone: "text-violet-600" },
            { label: "Buyers", value: m.activity.buyers, tone: "text-slate-700 dark:text-slate-200" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className={`text-2xl font-bold ${s.tone}`}>{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>

        {m.activity.open === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
            No open opportunities in the catalog yet — market insights populate as sources ingest.
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Regional demand" icon={Globe2}>
              <div className="space-y-2.5">
                {m.byCountry.slice(0, 10).map((c) => (
                  <Bar key={c.country} label={COUNTRY_NAME[c.country] ?? c.country} count={c.count} max={maxCountry} tone="bg-blue-500" />
                ))}
              </div>
            </Panel>

            <Panel title="Trending sectors" icon={Layers}>
              <div className="space-y-2.5">
                {m.bySector.slice(0, 10).map((s) => (
                  <Bar key={s.sector} label={SECTOR_LABEL[s.sector] ?? s.sector} count={s.count} max={maxSector} tone="bg-violet-500" />
                ))}
              </div>
            </Panel>

            <Panel title="Frequent buyers" icon={Building2}>
              {m.topBuyers.length === 0 ? (
                <p className="text-sm text-slate-400">No named buyers yet.</p>
              ) : (
                <ol className="space-y-2.5">
                  {m.topBuyers.map((b, i) => (
                    <li key={b.buyer} className="flex items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500 dark:bg-slate-800">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200" title={b.buyer}>
                        {b.buyer}
                      </span>
                      <span className="shrink-0 text-sm font-medium tabular-nums text-slate-500">{b.count}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>

            <Panel title="Expiring soon" icon={CalendarClock}>
              {m.expiring.length === 0 ? (
                <p className="text-sm text-slate-400">Nothing closing in the next 14 days.</p>
              ) : (
                <ul className="space-y-3">
                  {m.expiring.map((e) => (
                    <li key={e.id} className="border-l-2 border-amber-300 pl-3 dark:border-amber-700">
                      <p className="line-clamp-1 text-sm font-medium text-slate-800 dark:text-slate-100">{e.title}</p>
                      <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                        {e.country && <span>{COUNTRY_NAME[e.country] ?? e.country}</span>}
                        {e.sector && <span>· {SECTOR_LABEL[e.sector] ?? e.sector}</span>}
                        <span className="ml-auto inline-flex items-center gap-1 font-medium text-amber-600">
                          <CalendarClock className="h-3 w-3" />
                          {e.closingDate?.toISOString().slice(0, 10)}
                        </span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        )}

        <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <Sparkles className="h-3.5 w-3.5" /> Market-wide signals from the live tender catalog · refreshed daily
        </p>
      </div>
    </>
  );
}
