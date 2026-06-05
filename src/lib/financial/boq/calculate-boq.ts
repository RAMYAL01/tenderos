/**
 * Deterministic BOQ pricing engine (Part 2 — the Code Layer).
 *
 * Takes the LLM-extracted line items (Part 1), looks up internal rates from the
 * repository, and computes — with ZERO AI and ZERO floating-point drift — the
 * priced lines and grand totals.
 *
 * Per line:
 *   direct_cost = quantity × unit_cost
 *   overhead    = direct_cost × overhead_markup_pct
 *   profit      = (direct_cost + overhead) × profit_margin_pct
 *   line_total  = direct_cost + overhead + profit
 *
 * Convention: overhead is applied to direct cost; profit is applied to the
 * overhead-inclusive base (standard tender build-up). All arithmetic runs in
 * integer minor units via the BigInt money engine.
 *
 * Robustness: a missing rate, unit mismatch, currency mismatch, or invalid
 * quantity produces a structured per-line error and is SKIPPED — the rest of
 * the BOQ is still priced. Only an empty BOQ or invalid config throws.
 */

import type {
  BoqExtraction,
  BoqPricingResult,
  LineItemError,
  MoneyTotals,
  PricedLineItem,
  PricingConfig,
} from "./types";
import { BoqPricingError } from "./errors";
import { RateRepository, normalizeUnit } from "./rates-repository";
import {
  applyBasisPoints,
  decimalToMinor,
  minorToDecimalNumber,
  minorToNumber,
  multiplyQuantityByUnitCost,
  pctToBasisPoints,
  scaleQuantity,
} from "./money";

export async function priceBoq(
  extraction: BoqExtraction,
  config: PricingConfig,
  repo: RateRepository
): Promise<BoqPricingResult> {
  const cfg = normalizeConfig(config);
  const items = extraction?.line_items ?? [];

  if (items.length === 0) {
    throw new BoqPricingError("EMPTY_BOQ", "BOQ contains no line items to price.");
  }

  const decimals = cfg.currency_minor_decimals;
  const overheadBps = pctToBasisPoints(cfg.overhead_markup_pct);
  const profitBps = pctToBasisPoints(cfg.profit_margin_pct);

  // Single batched lookup (avoids N round-trips to Supabase).
  const uniqueCodes = [...new Set(items.map((i) => i.item_code))];
  const rates = await repo.getRatesForItemCodes(uniqueCodes);

  const priced: PricedLineItem[] = [];
  const errors: LineItemError[] = [];

  // Grand totals accumulated as BigInt minor units — exact.
  let directTotal = 0n;
  let overheadTotal = 0n;
  let profitTotal = 0n;
  let grandTotal = 0n;

  for (const item of items) {
    const fail = (code: LineItemError["code"], message: string) =>
      errors.push({ item_code: item.item_code, description: item.description, code, message });

    const rate = rates.get(item.item_code);
    if (!rate) {
      fail("RATE_NOT_FOUND", `No internal rate found for item_code "${item.item_code}".`);
      continue;
    }
    if (rate.currency.toUpperCase() !== cfg.currency) {
      fail(
        "CURRENCY_MISMATCH",
        `Rate currency ${rate.currency} does not match pricing currency ${cfg.currency}.`
      );
      continue;
    }
    if (normalizeUnit(item.unit_of_measurement) !== normalizeUnit(rate.unit_of_measurement)) {
      fail(
        "UNIT_MISMATCH",
        `Unit "${item.unit_of_measurement}" does not match the rate unit "${rate.unit_of_measurement}".`
      );
      continue;
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      fail("INVALID_QUANTITY", `Quantity "${item.quantity}" is missing or not a positive number.`);
      continue;
    }

    // ── deterministic arithmetic (integer minor units) ──
    const unitMinor = decimalToMinor(rate.unit_cost, decimals);
    const qtyScaled = scaleQuantity(item.quantity);

    const directMinor = multiplyQuantityByUnitCost(qtyScaled, unitMinor);
    const overheadMinor = applyBasisPoints(directMinor, overheadBps);
    const baseWithOverhead = directMinor + overheadMinor;
    const profitMinor = applyBasisPoints(baseWithOverhead, profitBps);
    const lineTotalMinor = baseWithOverhead + profitMinor;

    directTotal += directMinor;
    overheadTotal += overheadMinor;
    profitTotal += profitMinor;
    grandTotal += lineTotalMinor;

    priced.push({
      item_code: item.item_code,
      description: item.description,
      unit_of_measurement: normalizeUnit(item.unit_of_measurement),
      quantity: item.quantity,
      rate_source: rate.source,

      unit_cost_minor: minorToNumber(unitMinor),
      direct_cost_minor: minorToNumber(directMinor),
      overhead_amount_minor: minorToNumber(overheadMinor),
      profit_amount_minor: minorToNumber(profitMinor),
      line_total_minor: minorToNumber(lineTotalMinor),

      unit_cost: minorToDecimalNumber(unitMinor, decimals),
      direct_cost: minorToDecimalNumber(directMinor, decimals),
      overhead_amount: minorToDecimalNumber(overheadMinor, decimals),
      profit_amount: minorToDecimalNumber(profitMinor, decimals),
      line_total: minorToDecimalNumber(lineTotalMinor, decimals),
    });
  }

  const totals_minor: MoneyTotals = {
    direct_cost: minorToNumber(directTotal),
    overhead: minorToNumber(overheadTotal),
    profit: minorToNumber(profitTotal),
    grand_total: minorToNumber(grandTotal),
  };
  const totals: MoneyTotals = {
    direct_cost: minorToDecimalNumber(directTotal, decimals),
    overhead: minorToDecimalNumber(overheadTotal, decimals),
    profit: minorToDecimalNumber(profitTotal, decimals),
    grand_total: minorToDecimalNumber(grandTotal, decimals),
  };

  return {
    currency: cfg.currency,
    config: cfg,
    priced_items: priced,
    errors,
    totals_minor,
    totals,
    summary: {
      total_line_items: items.length,
      priced_line_items: priced.length,
      failed_line_items: errors.length,
    },
  };
}

/** Validate + normalize pricing config. Throws BoqPricingError("INVALID_CONFIG") on bad input. */
function normalizeConfig(config: PricingConfig): Required<PricingConfig> {
  if (!config || typeof config !== "object") {
    throw new BoqPricingError("INVALID_CONFIG", "Pricing config is required.");
  }
  const currency = String(config.currency ?? "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new BoqPricingError("INVALID_CONFIG", `currency must be a 3-letter ISO 4217 code (got "${config.currency}").`);
  }
  const decimals = config.currency_minor_decimals ?? 2;
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 6) {
    throw new BoqPricingError("INVALID_CONFIG", `currency_minor_decimals must be an integer in [0, 6] (got ${decimals}).`);
  }
  if (!Number.isFinite(config.overhead_markup_pct) || config.overhead_markup_pct < 0) {
    throw new BoqPricingError("INVALID_CONFIG", "overhead_markup_pct must be a number >= 0.");
  }
  if (!Number.isFinite(config.profit_margin_pct) || config.profit_margin_pct < 0) {
    throw new BoqPricingError("INVALID_CONFIG", "profit_margin_pct must be a number >= 0.");
  }
  return {
    currency,
    currency_minor_decimals: decimals,
    overhead_markup_pct: config.overhead_markup_pct,
    profit_margin_pct: config.profit_margin_pct,
  };
}
