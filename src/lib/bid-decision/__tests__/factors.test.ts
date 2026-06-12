import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeFactors,
  applyLlmAdjustment,
  recommend,
  MAX_LLM_ADJUSTMENT,
  BID_THRESHOLD,
  NO_BID_THRESHOLD,
  MIN_CONFIDENCE_FOR_CALL,
  type OrgProfileInput,
  type HistoryInput,
  type TenderFactsInput,
} from "../factors";

/**
 * Deterministic bid/no-bid factor engine tests. Same philosophy as the BOQ
 * money tests: the scoring layer is pure math and must be exactly reproducible.
 * The LLM may NEVER move the score beyond ±MAX_LLM_ADJUSTMENT — that fence is
 * the contract these tests pin.
 */

const NOW = new Date("2026-06-15T00:00:00Z");

const strongOrg: OrgProfileInput = {
  organizationType: "CONSTRUCTION_COMPANY",
  countryCode: "SA",
  industry: "construction",
  employeeCount: "201-500",
};

const richHistory: HistoryInput = {
  sectorWins: 8,
  sectorLosses: 2,
  countryWins: 10,
  countryLosses: 4,
  totalWins: 14,
  totalLosses: 8,
  sectorPriceLosses: 0,
};

const noHistory: HistoryInput = {
  sectorWins: 0,
  sectorLosses: 0,
  countryWins: 0,
  countryLosses: 0,
  totalWins: 0,
  totalLosses: 0,
  sectorPriceLosses: 0,
};

const idealTender: TenderFactsInput = {
  sector: "construction",
  clientCountry: "SA",
  estimatedValue: 50_000_000, // well inside the 201-500 band ceiling
  submissionDeadline: new Date("2026-07-30T00:00:00Z"), // 45 days out
  mandatoryRequirements: 10,
  criticalRequirements: 1,
};

test("ideal fit scores high and recommends BID", () => {
  const r = computeFactors(strongOrg, richHistory, idealTender, NOW);
  assert.ok(r.baseScore >= BID_THRESHOLD, `baseScore ${r.baseScore} should clear BID threshold`);
  assert.equal(recommend(applyLlmAdjustment(r.baseScore, 0), r.confidence), "BID");
  assert.equal(r.factors.profileFit, 1);
  assert.equal(r.factors.geographyFit, 1);
  assert.equal(r.factors.valueFit, 1);
});

test("out-of-class value + foreign market + dead deadline recommends NO_BID", () => {
  const bad: TenderFactsInput = {
    sector: "healthcare", // outside a construction company's lane
    clientCountry: "BR",
    estimatedValue: 5_000_000_000, // 10x the band ceiling
    submissionDeadline: new Date("2026-06-18T00:00:00Z"), // 3 days out
    mandatoryRequirements: 120,
    criticalRequirements: 20,
  };
  const r = computeFactors(strongOrg, richHistory, bad, NOW);
  assert.ok(r.baseScore <= NO_BID_THRESHOLD, `baseScore ${r.baseScore} should be under NO_BID threshold`);
  assert.equal(recommend(applyLlmAdjustment(r.baseScore, 0), r.confidence), "NO_BID");
});

test("no history → low confidence → forces REVIEW even on a great fit", () => {
  const sparseOrg: OrgProfileInput = {
    organizationType: null,
    countryCode: null,
    industry: null,
    employeeCount: null,
  };
  const sparseTender: TenderFactsInput = {
    sector: null,
    clientCountry: null,
    estimatedValue: null,
    submissionDeadline: null,
    mandatoryRequirements: 0,
    criticalRequirements: 0,
  };
  const r = computeFactors(sparseOrg, noHistory, sparseTender, NOW);
  assert.ok(r.confidence < MIN_CONFIDENCE_FOR_CALL, `confidence ${r.confidence} should be below the call floor`);
  assert.equal(recommend(applyLlmAdjustment(r.baseScore, 0.15), r.confidence), "REVIEW");
});

test("LLM adjustment is HARD-clamped to ±MAX_LLM_ADJUSTMENT", () => {
  assert.equal(applyLlmAdjustment(0.5, 0.9), +(0.5 + MAX_LLM_ADJUSTMENT).toFixed(4));
  assert.equal(applyLlmAdjustment(0.5, -0.9), +(0.5 - MAX_LLM_ADJUSTMENT).toFixed(4));
  assert.equal(applyLlmAdjustment(0.5, Number.NaN), 0.5); // garbage in → no nudge
  assert.equal(applyLlmAdjustment(0.97, 0.15), 1); // clamped into [0,1]
});

test("repeated PRICE losses in the sector apply the pricing red-flag penalty", () => {
  const priceBurned: HistoryInput = { ...richHistory, sectorPriceLosses: 3 };
  const base = computeFactors(strongOrg, richHistory, idealTender, NOW);
  const burned = computeFactors(strongOrg, priceBurned, idealTender, NOW);
  assert.ok(
    burned.factors.historyFit < base.factors.historyFit,
    "price-loss pattern must lower historyFit"
  );
});

test("smoothed win rate: 1-for-1 history does not read as certainty", () => {
  const oneWin: HistoryInput = { ...noHistory, sectorWins: 1, totalWins: 1 };
  const r = computeFactors(strongOrg, oneWin, idealTender, NOW);
  assert.ok(r.factors.historyFit < 0.75, `historyFit ${r.factors.historyFit} should be tempered by smoothing`);
});

test("deadline already passed zeroes the deadline factor", () => {
  const passed: TenderFactsInput = { ...idealTender, submissionDeadline: new Date("2026-06-10T00:00:00Z") };
  const r = computeFactors(strongOrg, richHistory, passed, NOW);
  assert.equal(r.factors.deadlinePressure, 0);
});

test("determinism: same inputs → identical output", () => {
  const a = computeFactors(strongOrg, richHistory, idealTender, NOW);
  const b = computeFactors(strongOrg, richHistory, idealTender, NOW);
  assert.deepEqual(a, b);
});
