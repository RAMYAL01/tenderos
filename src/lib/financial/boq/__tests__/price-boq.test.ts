/**
 * Integration test for the deterministic BOQ engine — proves the money path is
 * BigInt-exact and float-safe end to end. No DB: uses InMemoryRateRepository.
 *
 * Run: npm run test:boq
 */

import test from "node:test";
import assert from "node:assert/strict";

import { priceBoq } from "../calculate-boq";
import { InMemoryRateRepository } from "../rates-repository";
import type { BoqExtraction, PricingConfig, RateRecord } from "../types";

const SAR: PricingConfig = {
  overhead_markup_pct: 10,
  profit_margin_pct: 5,
  currency: "SAR",
  currency_minor_decimals: 2,
};

test("clean compounded total is exact to the halala", async () => {
  // Seed item 2.1.4 = 45.75 SAR/m2. qty 1000, +10% overhead, +5% profit.
  // direct=4_575_000  overhead=457_500  profit=251_625  total=5_284_125 (minor)
  const extraction: BoqExtraction = {
    line_items: [
      { item_code: "2.1.4", description: "RC slab", unit_of_measurement: "m2", quantity: 1000 },
    ],
  };
  const res = await priceBoq(extraction, SAR, new InMemoryRateRepository());

  assert.equal(res.priced_items.length, 1);
  const li = res.priced_items[0];
  assert.equal(li.direct_cost_minor, 4_575_000);
  assert.equal(li.overhead_amount_minor, 457_500);
  assert.equal(li.profit_amount_minor, 251_625);
  assert.equal(li.line_total_minor, 5_284_125);
  assert.equal(res.totals_minor.grand_total, 5_284_125);
  assert.equal(res.totals.grand_total, 52_841.25); // display decimal re-derived from minor
});

test("grand total === sum of line totals (BigInt closure, no drift)", async () => {
  const extraction: BoqExtraction = {
    line_items: [
      { item_code: "2.1.4", description: "RC slab", unit_of_measurement: "m2", quantity: 1234.5 },
      { item_code: "3.4.9", description: "Rebar", unit_of_measurement: "ton", quantity: 87.25 },
      { item_code: "5.1.2", description: "Fitting", unit_of_measurement: "no", quantity: 9999 },
    ],
  };
  const res = await priceBoq(extraction, SAR, new InMemoryRateRepository());

  const sum = res.priced_items.reduce((acc, li) => acc + li.line_total_minor, 0);
  assert.equal(sum, res.totals_minor.grand_total);

  const directSum = res.priced_items.reduce((a, li) => a + li.direct_cost_minor, 0);
  assert.equal(directSum, res.totals_minor.direct_cost);
});

test("deterministic: same inputs -> identical output", async () => {
  const extraction: BoqExtraction = {
    line_items: [{ item_code: "2.1.4", description: "x", unit_of_measurement: "m2", quantity: 333.333 }],
  };
  const a = await priceBoq(extraction, SAR, new InMemoryRateRepository());
  const b = await priceBoq(extraction, SAR, new InMemoryRateRepository());
  assert.deepEqual(a.totals_minor, b.totals_minor);
  assert.equal(a.priced_items[0].line_total_minor, b.priced_items[0].line_total_minor);
});

test("float-safety: string-decimal rounding beats naive float (1.005 -> 1.01)", async () => {
  // Naive JS would under-round: Math.round(1.005 * 100) === 100. The engine
  // parses the decimal as a string and rounds half-up -> 101 minor (1.01).
  const seed: RateRecord[] = [
    { item_code: "FT-1", unit_of_measurement: "no", unit_cost: "1.005", currency: "SAR", source: "material_costs" },
  ];
  const res = await priceBoq(
    { line_items: [{ item_code: "FT-1", description: "trap", unit_of_measurement: "no", quantity: 1 }] },
    { overhead_markup_pct: 0, profit_margin_pct: 0, currency: "SAR", currency_minor_decimals: 2 },
    new InMemoryRateRepository(seed)
  );

  assert.equal(res.priced_items[0].unit_cost_minor, 101); // engine: half-up
  assert.equal(res.priced_items[0].line_total_minor, 101);
  assert.equal(Math.round(1.005 * 100), 100); // naive float would be WRONG
  assert.notEqual(res.priced_items[0].unit_cost_minor, Math.round(1.005 * 100));
});

test("defensive: missing rate is flagged, the rest of the BOQ still prices", async () => {
  const extraction: BoqExtraction = {
    line_items: [
      { item_code: "2.1.4", description: "ok", unit_of_measurement: "m2", quantity: 10 },
      { item_code: "NOPE-1", description: "no rate", unit_of_measurement: "no", quantity: 5 },
    ],
  };
  const res = await priceBoq(extraction, SAR, new InMemoryRateRepository());

  assert.equal(res.summary.priced_line_items, 1);
  assert.equal(res.summary.failed_line_items, 1);
  assert.equal(res.errors[0].code, "RATE_NOT_FOUND");
  assert.equal(res.errors[0].item_code, "NOPE-1");
  assert.ok(res.totals_minor.grand_total > 0); // priced line still contributes
});

test("invalid quantity (NaN from extractor) is flagged, never silently zero", async () => {
  const extraction: BoqExtraction = {
    line_items: [{ item_code: "2.1.4", description: "x", unit_of_measurement: "m2", quantity: Number.NaN }],
  };
  const res = await priceBoq(extraction, SAR, new InMemoryRateRepository());
  assert.equal(res.summary.priced_line_items, 0);
  assert.equal(res.errors[0].code, "INVALID_QUANTITY");
});
