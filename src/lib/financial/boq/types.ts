/**
 * Type contracts for the BOQ financial pipeline.
 *
 * Two trust boundaries are modeled here:
 *   1. The LLM extraction contract — the ONLY thing Claude is allowed to return.
 *   2. The deterministic pricing contract — what the calculation engine returns.
 *
 * MONEY REPRESENTATION
 * Every monetary value in the OUTPUT is expressed two ways:
 *   - `*_minor`: integer minor units (e.g. halalas / cents). This is the
 *     canonical, precision-safe value. All arithmetic happens on these.
 *   - `*`: a decimal number for DISPLAY ONLY. Never do math on these — they can
 *     carry IEEE-754 error. Re-derive from `_minor` if you need to recompute.
 */

// ── Part 1 contract: LLM extraction output ────────────────────────────────────

/** Unit of measure, normalized lowercase (e.g. "m2", "hr", "no", "ls", "m3", "ton", "kg"). */
export type UnitOfMeasurement = string;

/**
 * A single BOQ line item EXACTLY as extracted by the LLM.
 * Contains NO prices, rates, amounts, or computed values — by design.
 */
export interface ExtractedBoqLineItem {
  item_code: string; // BOQ reference, e.g. "2.1.4"
  description: string;
  unit_of_measurement: UnitOfMeasurement;
  /** Document-supplied quantity. May be fractional. NaN if the LLM could not find one. */
  quantity: number;
}

/** Full LLM extraction payload (Part 1 output). */
export interface BoqExtraction {
  line_items: ExtractedBoqLineItem[];
  /** ISO 4217 code if the source document states one — informational only. */
  source_currency?: string;
}

// ── Rate catalogue (backed by the mocked Supabase repository) ──────────────────

export type RateSource = "labor_rates" | "material_costs";

/** An internal cost rate row from `labor_rates` / `material_costs`. */
export interface RateRecord {
  item_code: string;
  unit_of_measurement: UnitOfMeasurement;
  /** Internal unit cost as a decimal in MAJOR currency units (e.g. 45.75 SAR). */
  unit_cost: number;
  /** ISO 4217 — must match the pricing currency. */
  currency: string;
  source: RateSource;
  /** ISO date — supports rate versioning / effective-dated lookups. */
  effective_from?: string;
}

// ── Pricing configuration ─────────────────────────────────────────────────────

export interface PricingConfig {
  /** Overhead markup applied to direct cost, as a percentage. e.g. 12.5 = 12.5%. */
  overhead_markup_pct: number;
  /** Profit margin applied after overhead, as a percentage. e.g. 10 = 10%. */
  profit_margin_pct: number;
  /** Output currency (ISO 4217). Must equal the rate-catalogue currency. */
  currency: string;
  /** Minor-unit decimal places for the currency. Default 2. */
  currency_minor_decimals?: number;
}

// ── Part 2 contract: deterministic pricing output ─────────────────────────────

export interface PricedLineItem {
  item_code: string;
  description: string;
  unit_of_measurement: UnitOfMeasurement;
  quantity: number;
  rate_source: RateSource;

  // canonical integer minor units (use these for any further math)
  unit_cost_minor: number;
  direct_cost_minor: number; // quantity × unit_cost
  overhead_amount_minor: number; // direct_cost × overhead%
  profit_amount_minor: number; // (direct_cost + overhead) × margin%
  line_total_minor: number; // direct_cost + overhead + profit

  // display decimals (DO NOT compute with these)
  unit_cost: number;
  direct_cost: number;
  overhead_amount: number;
  profit_amount: number;
  line_total: number;
}

export type LineItemErrorCode =
  | "RATE_NOT_FOUND"
  | "UNIT_MISMATCH"
  | "INVALID_QUANTITY"
  | "CURRENCY_MISMATCH";

/** A non-fatal, per-line failure. Processing continues for the rest of the BOQ. */
export interface LineItemError {
  item_code: string;
  description: string;
  code: LineItemErrorCode;
  message: string;
}

export interface MoneyTotals {
  direct_cost: number;
  overhead: number;
  profit: number;
  grand_total: number;
}

export interface BoqPricingResult {
  currency: string;
  config: Required<PricingConfig>;

  priced_items: PricedLineItem[];
  errors: LineItemError[];

  /** Grand totals in integer minor units (canonical). */
  totals_minor: MoneyTotals;
  /** Grand totals as display decimals. */
  totals: MoneyTotals;

  summary: {
    total_line_items: number;
    priced_line_items: number;
    failed_line_items: number;
  };
}
