import { test } from "node:test";
import assert from "node:assert/strict";
import { matchSatisfiesSavedSearch, matchSatisfiesAnyPolicy, type MatchLike } from "../saved-search-filter";

const NOW = new Date("2026-07-02T00:00:00Z").getTime();

function m(over: Partial<Omit<MatchLike, "opportunity">> & { opportunity?: Partial<MatchLike["opportunity"]> } = {}): MatchLike {
  return {
    relevanceScore: over.relevanceScore ?? 0.5,
    trackingStatus: over.trackingStatus ?? "NEW",
    opportunity: {
      titleEn: "Construction of Riyadh Metro Station",
      titleAr: null,
      buyerName: "Riyadh Municipality",
      sector: "construction",
      country: "SA",
      closingDate: new Date(NOW + 3 * 86_400_000), // 3 days out
      ...(over.opportunity ?? {}),
    },
  };
}

test("query matches across title/buyer/sector/country (case-insensitive)", () => {
  assert.equal(matchSatisfiesSavedSearch(m(), { query: "metro" }, NOW), true);
  assert.equal(matchSatisfiesSavedSearch(m(), { query: "RIYADH" }, NOW), true);
  assert.equal(matchSatisfiesSavedSearch(m(), { query: "sa" }, NOW), true);
  assert.equal(matchSatisfiesSavedSearch(m(), { query: "healthcare" }, NOW), false);
});

test("closing filter requires a date within 7 days", () => {
  assert.equal(matchSatisfiesSavedSearch(m(), { filter: "closing" }, NOW), true);
  const far = m({ opportunity: { closingDate: new Date(NOW + 30 * 86_400_000) } });
  assert.equal(matchSatisfiesSavedSearch(far, { filter: "closing" }, NOW), false);
});

test("strong filter requires relevance >= 0.6", () => {
  assert.equal(matchSatisfiesSavedSearch(m({ relevanceScore: 0.7 }), { filter: "strong" }, NOW), true);
  assert.equal(matchSatisfiesSavedSearch(m({ relevanceScore: 0.5 }), { filter: "strong" }, NOW), false);
});

test("query AND filter must both hold", () => {
  const far = m({ opportunity: { closingDate: new Date(NOW + 30 * 86_400_000) } });
  assert.equal(matchSatisfiesSavedSearch(far, { query: "metro", filter: "closing" }, NOW), false);
});

test("any-policy: no surfacing policy → not over-constrained (unchanged behavior)", () => {
  assert.equal(matchSatisfiesAnyPolicy(m(), [], NOW), true);
  assert.equal(matchSatisfiesAnyPolicy(m(), [{ filter: "all" }, { filter: "saved" }, {}], NOW), true);
});

test("any-policy: passes if ANY surfacing policy holds, else fails", () => {
  assert.equal(matchSatisfiesAnyPolicy(m(), [{ query: "healthcare" }, { query: "metro" }], NOW), true);
  assert.equal(matchSatisfiesAnyPolicy(m(), [{ query: "healthcare" }, { query: "defense" }], NOW), false);
});
