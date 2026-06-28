import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOcdsAwards } from "../parse-ocds-awards";
import type { GazetteAdapterSource } from "../types";

const SOURCE: GazetteAdapterSource = {
  id: "s1",
  slug: "test-ocds",
  baseUrl: "https://example.test/ocds",
  country: "SA",
  defaultLanguage: "EN",
};

test("parseOcdsAwards extracts an active award with supplier + value + buyer + bidders", () => {
  const payload = {
    releases: [
      {
        ocid: "ocds-abc-001",
        date: "2026-05-01T00:00:00Z",
        buyer: { name: "Ministry of Water" },
        tender: { mainProcurementCategory: "works", numberOfTenderers: 7 },
        awards: [
          {
            id: "A1",
            status: "active",
            date: "2026-05-10T00:00:00Z",
            suppliers: [{ name: "Al Bahar Contracting LLC" }],
            value: { amount: 12_500_000, currency: "SAR" },
          },
        ],
      },
    ],
  };
  const out = parseOcdsAwards(payload, SOURCE);
  assert.equal(out.length, 1);
  const a = out[0];
  assert.equal(a.externalId, "ocds-abc-001:A1");
  assert.equal(a.winnerName, "Al Bahar Contracting LLC");
  assert.equal(a.buyerName, "Ministry of Water");
  assert.equal(a.awardedValue, 12_500_000);
  assert.equal(a.currency, "SAR");
  assert.equal(a.sector, "works");
  assert.equal(a.country, "SA");
  assert.equal(a.bidderCount, 7);
});

test("parseOcdsAwards skips non-active awards and releases without awards[]", () => {
  const payload = {
    results: [
      {
        releases: [
          { ocid: "x:1", awards: [{ id: "A", status: "cancelled", suppliers: [{ name: "X" }], value: { amount: 1, currency: "USD" } }] },
          { ocid: "x:2", tender: { title: "open tender, no award yet" } },
          { ocid: "x:3", awards: [{ id: "B", status: "active", suppliers: [{ name: "Winner Co" }], value: { amount: 5_000_000, currency: "AED" } }] },
        ],
      },
    ],
  };
  const out = parseOcdsAwards(payload, SOURCE);
  assert.equal(out.length, 1);
  assert.equal(out[0].winnerName, "Winner Co");
  assert.equal(out[0].externalId, "x:3:B");
});

test("parseOcdsAwards tolerates a bare release array and missing optional fields", () => {
  const payload = [
    { ocid: "y:1", awards: [{ id: "1", suppliers: [{ name: "Solo Co" }] }] }, // no value, no status → treated active
  ];
  const out = parseOcdsAwards(payload, { ...SOURCE, country: null });
  assert.equal(out.length, 1);
  assert.equal(out[0].winnerName, "Solo Co");
  assert.equal(out[0].awardedValue, null);
  assert.equal(out[0].country, null);
});

test("parseOcdsAwards ignores releases with no ocid/id", () => {
  const out = parseOcdsAwards({ releases: [{ awards: [{ id: "A", suppliers: [{ name: "X" }] }] }] }, SOURCE);
  assert.equal(out.length, 0);
});
