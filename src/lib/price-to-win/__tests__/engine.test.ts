import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMarketCurve, recommendPrice, winProbAtPrice } from "../engine";

const seq = (n: number) => Array.from({ length: n }, (_, i) => i + 1); // 1..n
function approx(a: number, b: number, eps = 0.08) {
  assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b} (±${eps})`);
}

test("buildMarketCurve computes quantiles and a monotonic-decreasing win curve", () => {
  const m = buildMarketCurve(seq(100));
  assert.equal(m.cohortSize, 100);
  approx(m.median, 50.5, 0.001);
  approx(m.min, 1, 0.001);
  approx(m.max, 100, 0.001);
  assert.ok(m.p25 < m.median && m.median < m.p75);

  for (let i = 1; i < m.points.length; i++) {
    assert.ok(m.points[i].price >= m.points[i - 1].price, "price ascends");
    assert.ok(m.points[i].winProb <= m.points[i - 1].winProb + 1e-9, "winProb non-increasing");
  }
  for (const pt of m.points) assert.ok(pt.winProb >= 0 && pt.winProb <= 1);
});

test("winProbAtPrice is high at low prices, low at high prices, ~0.5 at the median", () => {
  const m = buildMarketCurve(seq(100));
  const low = winProbAtPrice(m, 5);
  const mid = winProbAtPrice(m, 50);
  const high = winProbAtPrice(m, 96);
  assert.ok(low > 0.8, `low=${low}`);
  assert.ok(high < 0.2, `high=${high}`);
  assert.ok(mid > high && mid < low);
  approx(mid, 0.5);
});

test("recommendPrice maximizes EV, stays above cost, reports margin (uniform 1..100, cost 20 → ~60)", () => {
  const m = buildMarketCurve(seq(100));
  const rec = recommendPrice(m, 20)!;
  assert.ok(rec.recommendedPrice > 20, "above cost");
  assert.ok(rec.recommendedPrice > 40 && rec.recommendedPrice < 85, `rec=${rec.recommendedPrice}`);
  assert.ok(rec.winProb > 0 && rec.winProb < 1, `winProb=${rec.winProb}`);
  approx(rec.margin, rec.recommendedPrice - 20, 0.01);
  assert.ok(rec.expectedValue > 0);
  assert.equal(rec.aboveMarket, false);
});

test("recommendPrice flags a cost above the whole market as uncompetitive", () => {
  const m = buildMarketCurve(seq(20).map((v) => v * 10)); // 10..200
  const rec = recommendPrice(m, 500)!;
  assert.equal(rec.aboveMarket, true);
  assert.ok(rec.recommendedPrice >= 500);
});

test("buildMarketCurve tolerates empty and all-equal inputs", () => {
  const empty = buildMarketCurve([]);
  assert.equal(empty.cohortSize, 0);
  assert.equal(empty.points.length, 0);
  assert.equal(recommendPrice(empty, 10), null);

  const flat = buildMarketCurve([100, 100, 100]);
  assert.equal(flat.median, 100);
  assert.ok(flat.points.length > 0);
  const rec = recommendPrice(flat, 50)!;
  assert.ok(rec.recommendedPrice >= 100 - 1e-6, `rec=${rec.recommendedPrice}`);
  approx(rec.winProb, 1, 1e-6);
});
