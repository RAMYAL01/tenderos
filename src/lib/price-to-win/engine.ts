/**
 * Price-to-Win engine (Wave 2, item 3).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DETERMINISTIC. NO AI. Given the distribution of REAL winning bid values for a
 * comparable {sector · country · value-band} cell (from the cross-customer award
 * pool) plus the bidder's OWN cost, this recommends the price that maximizes
 * EXPECTED VALUE = P(win | price) × (price − cost). Same inputs → same output.
 *
 * This is the deliberate counterpart to optimization/score.ts `assessPricing()`,
 * which only flags margin bands and never names a price. The recommendation here
 * is a transparent empirical calculation over real market data — not an AI guess,
 * and not the app "setting a price" out of thin air.
 *
 * Win-probability model (explainable, price-competitiveness proxy):
 *   P(win | X) = share of past WINNING prices that were ≥ X.
 * i.e. a bid at X out-prices that fraction of the winners. Monotonic ↓ in price.
 * It assumes price is the deciding factor (the #1 recorded loss reason) — surfaced
 * to the user as an estimate, never a guarantee (technical score also matters).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const CURVE_POINTS = 40;

export interface MarketCurvePoint {
  price: number; // major units, market currency
  winProb: number; // 0..1 — share of past winners priced ≥ price
}

export interface PriceToWinMarket {
  cohortSize: number;
  currency: string | null;
  points: MarketCurvePoint[]; // sorted by price asc — the survival curve, safe to send to the client
  median: number;
  p25: number;
  p75: number;
  min: number;
  max: number;
}

export interface PriceRecommendation {
  recommendedPrice: number;
  winProb: number; // at the recommended price
  margin: number; // recommendedPrice − cost
  marginPct: number; // margin / recommendedPrice × 100
  expectedValue: number; // winProb × margin (the maximized objective)
  aboveMarket: boolean; // cost sits above the whole winning distribution → structurally uncompetitive
}

// ── Market curve (server-side: from raw values) ────────────────────────────────

/**
 * Build the win-probability-vs-price curve from raw winning values. Only aggregate
 * points leave this function — raw values never reach the client. Caller must have
 * already enforced the k-anonymity cohort floor.
 */
export function buildMarketCurve(values: number[]): PriceToWinMarket {
  const sorted = [...values].filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) {
    return { cohortSize: 0, currency: null, points: [], median: 0, p25: 0, p75: 0, min: 0, max: 0 };
  }

  const min = sorted[0];
  const max = sorted[n - 1];
  const lo = quantile(sorted, 0.02); // trim outliers so the chart range stays readable
  const hi = quantile(sorted, 0.98);
  const span = hi - lo;

  const points: MarketCurvePoint[] = [];
  for (let i = 0; i < CURVE_POINTS; i++) {
    const price = span > 0 ? lo + (span * i) / (CURVE_POINTS - 1) : lo;
    points.push({ price: round2(price), winProb: survival(sorted, price) });
  }

  return {
    cohortSize: n,
    currency: null,
    points,
    median: round2(quantile(sorted, 0.5)),
    p25: round2(quantile(sorted, 0.25)),
    p75: round2(quantile(sorted, 0.75)),
    min: round2(min),
    max: round2(max),
  };
}

// ── Recommendation + lookups (client-safe: from the curve + live cost) ─────────

/** Interpolated win probability at an arbitrary price, from the market curve. */
export function winProbAtPrice(market: PriceToWinMarket, price: number): number {
  const pts = market.points;
  if (pts.length === 0) return 0;
  if (price <= pts[0].price) return pts[0].winProb;
  if (price >= pts[pts.length - 1].price) return pts[pts.length - 1].winProb;
  for (let i = 1; i < pts.length; i++) {
    if (price <= pts[i].price) {
      const a = pts[i - 1];
      const b = pts[i];
      const t = b.price === a.price ? 0 : (price - a.price) / (b.price - a.price);
      return clamp01(a.winProb + (b.winProb - a.winProb) * t);
    }
  }
  return pts[pts.length - 1].winProb;
}

/**
 * Recommend the price that maximizes expected value = P(win|price) × (price − cost).
 * Never recommends below cost. Returns null if the market has no usable points.
 */
export function recommendPrice(market: PriceToWinMarket, cost: number): PriceRecommendation | null {
  if (market.points.length === 0) return null;
  const aboveMarket = cost > market.max;

  let best: PriceRecommendation | null = null;
  for (const pt of market.points) {
    const price = Math.max(pt.price, cost);
    const margin = price - cost;
    if (margin <= 0) continue;
    const winProb = winProbAtPrice(market, price);
    const expectedValue = winProb * margin;
    if (!best || expectedValue > best.expectedValue) {
      best = {
        recommendedPrice: round2(price),
        winProb,
        margin: round2(margin),
        marginPct: round1((margin / price) * 100),
        expectedValue,
        aboveMarket,
      };
    }
  }

  // Cost is at/above the whole winning distribution → no profitable competitive price.
  if (!best) {
    const price = round2(cost * 1.01);
    const winProb = winProbAtPrice(market, price);
    const margin = round2(price - cost);
    best = {
      recommendedPrice: price,
      winProb,
      margin,
      marginPct: 1,
      expectedValue: winProb * margin,
      aboveMarket: true,
    };
  }
  return best;
}

// ── helpers ────────────────────────────────────────────────────────────────────

/** fraction of sorted (asc) values ≥ x. */
function survival(sorted: number[], x: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return (sorted.length - lo) / sorted.length;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
function round1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
