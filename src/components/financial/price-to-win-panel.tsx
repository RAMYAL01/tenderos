"use client";

import { Target, Info } from "lucide-react";
import { recommendPrice, winProbAtPrice, type PriceToWinMarket } from "@/lib/price-to-win/engine";

/**
 * Price-to-Win panel — a LIVE win-probability-vs-price curve for the tender's
 * {sector · country · value-band} cell, plus the EV-optimal target price computed
 * against the builder's current cost. Deterministic (see lib/price-to-win/engine).
 * Rendered inside the FinancialBuilder so `cost` / `price` update as the user edits.
 */

interface Props {
  market: PriceToWinMarket;
  cost: number; // cost before profit — the break-even floor
  price: number; // current net bid price (ex-VAT)
  currency: string; // the proposal currency
}

function compact(n: number, cur: string): string {
  const abs = Math.abs(n);
  const s =
    abs >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : abs >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : abs >= 1e3 ? `${Math.round(n / 1e3)}K` : `${Math.round(n)}`;
  return `${cur} ${s}`;
}

export function PriceToWinPanel({ market, cost, price, currency }: Props) {
  const mcur = market.currency ?? currency;
  const sameCurrency = !market.currency || market.currency === currency;
  const pts = market.points;
  if (pts.length === 0) return null;

  // ── chart geometry ──
  const W = 320, H = 120, padL = 6, padR = 6, padT = 10, padB = 16;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const xMin = pts[0].price;
  const xMax = pts[pts.length - 1].price;
  const xOf = (p: number) => padL + (xMax === xMin ? 0 : Math.max(0, Math.min(1, (p - xMin) / (xMax - xMin))) * plotW);
  const yOf = (w: number) => padT + (1 - Math.max(0, Math.min(1, w))) * plotH;

  const line = pts.map((pt, i) => `${i ? "L" : "M"}${xOf(pt.price).toFixed(1)} ${yOf(pt.winProb).toFixed(1)}`).join(" ");
  const area = `${line} L${xOf(xMax).toFixed(1)} ${yOf(0).toFixed(1)} L${xOf(xMin).toFixed(1)} ${yOf(0).toFixed(1)} Z`;

  const rec = sameCurrency ? recommendPrice(market, cost) : null;
  const priceInRange = sameCurrency && price > 0 && price >= xMin && price <= xMax;
  const currentWinProb = sameCurrency && price > 0 ? winProbAtPrice(market, price) : null;

  const pct = (w: number) => `${Math.round(w * 100)}%`;

  return (
    <div className="rounded-xl border border-blue-200/70 bg-gradient-to-br from-blue-50/60 to-white p-5 shadow-sm dark:border-blue-900/40 dark:from-blue-950/25 dark:to-slate-900">
      <div className="mb-3 flex items-center gap-2">
        <Target className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Price-to-Win</h3>
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
          Market-derived
        </span>
      </div>

      {!sameCurrency ? (
        <p className="rounded-lg bg-white/70 px-3 py-3 text-xs text-slate-500 dark:bg-slate-900/50">
          The market for this cell is priced in <strong>{mcur}</strong> (median{" "}
          {compact(market.median, mcur)}). Set this proposal&rsquo;s currency to {mcur} to see an EV-optimal target price
          against your cost.
        </p>
      ) : rec ? (
        <>
          {/* Recommended target */}
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Recommended target</p>
              <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                {compact(rec.recommendedPrice, mcur)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                ~{pct(rec.winProb)} est. win rate · {rec.marginPct}% margin
              </p>
            </div>
            {currentWinProb != null && (
              <div className="text-right">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Your price</p>
                <p className="text-lg font-semibold tabular-nums text-slate-700 dark:text-slate-200">{compact(price, mcur)}</p>
                <p className={`mt-0.5 text-[11px] ${currentWinProb >= rec.winProb ? "text-emerald-600" : "text-amber-600"}`}>
                  ~{pct(currentWinProb)} est. win rate
                </p>
              </div>
            )}
          </div>

          {/* Win-probability-vs-price curve */}
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Win probability versus price">
            <defs>
              <linearGradient id="ptwFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(59 130 246)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="rgb(59 130 246)" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#ptwFill)" />
            <path d={line} fill="none" stroke="rgb(37 99 235)" strokeWidth="2" vectorEffect="non-scaling-stroke" />

            {/* recommended target marker */}
            <line
              x1={xOf(rec.recommendedPrice)} y1={yOf(0)} x2={xOf(rec.recommendedPrice)} y2={yOf(rec.winProb)}
              stroke="rgb(16 185 129)" strokeWidth="1.5" strokeDasharray="3 2" vectorEffect="non-scaling-stroke"
            />
            <circle cx={xOf(rec.recommendedPrice)} cy={yOf(rec.winProb)} r="3.5" fill="rgb(16 185 129)" />

            {/* current price marker */}
            {priceInRange && currentWinProb != null && (
              <>
                <line
                  x1={xOf(price)} y1={yOf(0)} x2={xOf(price)} y2={yOf(currentWinProb)}
                  stroke="rgb(100 116 139)" strokeWidth="1.5" strokeDasharray="2 2" vectorEffect="non-scaling-stroke"
                />
                <circle cx={xOf(price)} cy={yOf(currentWinProb)} r="3" fill="rgb(71 85 105)" />
              </>
            )}
          </svg>

          {/* axis labels */}
          <div className="mt-1 flex justify-between text-[10px] tabular-nums text-slate-400">
            <span>{compact(xMin, mcur)}</span>
            <span>median {compact(market.median, mcur)}</span>
            <span>{compact(xMax, mcur)}</span>
          </div>

          {/* nudge / warning */}
          {rec.aboveMarket ? (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              Your cost is above every past winning bid in this cell — you&rsquo;re structurally uncompetitive on price here.
              Win on scope/technical, or drive cost down.
            </p>
          ) : currentWinProb != null && price > rec.recommendedPrice ? (
            <p className="mt-3 text-[11px] text-slate-500">
              Lowering toward <strong>{compact(rec.recommendedPrice, mcur)}</strong> trades margin for a higher expected win —
              that&rsquo;s the EV-optimal point given your cost.
            </p>
          ) : currentWinProb != null && price > 0 && price < rec.recommendedPrice ? (
            <p className="mt-3 text-[11px] text-slate-500">
              You&rsquo;re priced below the EV-optimal target — you could raise toward{" "}
              <strong>{compact(rec.recommendedPrice, mcur)}</strong> for more margin without giving up much win probability.
            </p>
          ) : null}
        </>
      ) : null}

      <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-400">
        <Info className="mt-px h-3 w-3 shrink-0" />
        From {market.cohortSize} anonymized winning awards in this sector · region · size band. A price-competitiveness
        estimate (share of past winners priced at or above a given price) — not a guarantee; technical score also decides.
      </p>
    </div>
  );
}
