import { test } from "node:test";
import assert from "node:assert/strict";
import { reversePlan } from "../reverse-plan";

const NOW = new Date("2026-07-02T00:00:00Z");
const DAY = 86_400_000;

test("empty when no deadline or the deadline is in the past", () => {
  assert.equal(reversePlan(null, NOW).length, 0);
  assert.equal(reversePlan(new Date(NOW.getTime() - DAY), NOW).length, 0);
});

test("seven ordered stages ending exactly at the deadline", () => {
  const deadline = new Date(NOW.getTime() + 20 * DAY);
  const plan = reversePlan(deadline, NOW);
  assert.equal(plan.length, 7);
  for (let i = 1; i < plan.length; i++) {
    assert.ok(plan[i].dueAt.getTime() >= plan[i - 1].dueAt.getTime(), "due dates ascend");
    assert.equal(plan[i].orderIndex, i);
  }
  assert.equal(plan[0].key, "go_no_go");
  assert.equal(plan[plan.length - 1].key, "submit");
  assert.equal(plan[plan.length - 1].dueAt.getTime(), deadline.getTime());
});

test("every due date sits within [now, deadline], even for a short lead time", () => {
  const deadline = new Date(NOW.getTime() + 3 * DAY);
  const plan = reversePlan(deadline, NOW);
  for (const m of plan) {
    assert.ok(m.dueAt.getTime() >= NOW.getTime(), "not before now");
    assert.ok(m.dueAt.getTime() <= deadline.getTime(), "not after deadline");
  }
});
