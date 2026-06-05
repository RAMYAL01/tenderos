/**
 * Deterministic financial calculation engine.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CRITICAL INVARIANT: AI NEVER SETS A PRICE.
 * Every monetary figure produced here is a pure arithmetic function of
 * USER-ENTERED inputs (CostLine.unitRate, quantities) and USER-SET assumptions
 * (overhead %, contingency %, profit %, VAT %). There is no AI, no estimation,
 * no inference in this file. Same inputs → same outputs, always.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { CostCategory } from "@prisma/client";

export interface CostLineInput {
  category: CostCategory;
  quantity: number;
  unitRate: number; // user-entered only
}

export interface FinancialAssumptions {
  overheadPct: number;
  contingencyPct: number;
  profitMarginPct: number;
  vatPct: number;
}

export interface CategorySubtotal {
  category: CostCategory;
  amount: number;
  lineCount: number;
}

export interface CostBreakdown {
  byCategory: CategorySubtotal[];
  directCost: number; // Σ(quantity × unitRate)
  overhead: number; // directCost × overheadPct
  contingency: number; // (directCost + overhead) × contingencyPct
  indirectCost: number; // overhead + contingency
  costBeforeProfit: number; // directCost + indirectCost
  profit: number; // costBeforeProfit × profitMarginPct
  netPrice: number; // costBeforeProfit + profit (the bid price, ex-tax)
  vat: number; // netPrice × vatPct
  totalPrice: number; // netPrice + vat
}

/** Line total — the only place a per-line amount is derived. */
export function lineTotal(line: Pick<CostLineInput, "quantity" | "unitRate">): number {
  return round2(toNum(line.quantity) * toNum(line.unitRate));
}

const ALL_CATEGORIES: CostCategory[] = [
  "LABOR",
  "EQUIPMENT",
  "MATERIAL",
  "SUBCONTRACTOR",
  "TRANSPORT",
  "OTHER_DIRECT",
];

/**
 * Compute the full cost breakdown for a financial proposal.
 * Pure function — deterministic, side-effect free.
 */
export function computeBreakdown(
  lines: CostLineInput[],
  a: FinancialAssumptions
): CostBreakdown {
  // Direct cost grouped by category
  const byCategory: CategorySubtotal[] = ALL_CATEGORIES.map((category) => {
    const catLines = lines.filter((l) => l.category === category);
    const amount = round2(
      catLines.reduce((sum, l) => sum + toNum(l.quantity) * toNum(l.unitRate), 0)
    );
    return { category, amount, lineCount: catLines.length };
  }).filter((c) => c.lineCount > 0);

  const directCost = round2(byCategory.reduce((s, c) => s + c.amount, 0));

  const overhead = round2(directCost * pct(a.overheadPct));
  const contingency = round2((directCost + overhead) * pct(a.contingencyPct));
  const indirectCost = round2(overhead + contingency);

  const costBeforeProfit = round2(directCost + indirectCost);
  const profit = round2(costBeforeProfit * pct(a.profitMarginPct));
  const netPrice = round2(costBeforeProfit + profit);

  const vat = round2(netPrice * pct(a.vatPct));
  const totalPrice = round2(netPrice + vat);

  return {
    byCategory,
    directCost,
    overhead,
    contingency,
    indirectCost,
    costBeforeProfit,
    profit,
    netPrice,
    vat,
    totalPrice,
  };
}

/** Format a number as a currency amount string. */
export function formatMoney(amount: number, currency = "SAR"): string {
  return `${currency} ${round2(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const CATEGORY_LABELS: Record<CostCategory, string> = {
  LABOR: "Labor",
  EQUIPMENT: "Equipment",
  MATERIAL: "Material",
  SUBCONTRACTOR: "Subcontractor",
  TRANSPORT: "Transport",
  OTHER_DIRECT: "Other Direct",
};

// ── internals ──
function toNum(v: number | string | { toString(): string }): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}
function pct(p: number): number {
  return toNum(p) / 100;
}
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
