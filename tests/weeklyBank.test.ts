import test from "node:test";
import assert from "node:assert/strict";
import { computeWeeklySettlement } from "../lib/weeklyBank.ts";

const perfectStandings = [
  { user_id: "first", display_name: "First", wins: 5, losses: 0, pushes: 0, win_pct: 1, rank: 1 },
  { user_id: "second", display_name: "Second", wins: 4, losses: 1, pushes: 0, win_pct: 0.8, rank: 2 },
  { user_id: "last", display_name: "Last", wins: 3, losses: 2, pushes: 0, win_pct: 0.6, rank: 3 }
];

test("a perfect week doubles the Shaw weekly settlement", () => {
  const result = computeWeeklySettlement(perfectStandings, true);
  assert.equal(result.perfect, true);
  assert.equal(result.amounts.get("first"), 60);
  assert.equal(result.amounts.get("second"), -20);
  assert.equal(result.amounts.get("last"), -40);
});

test("the perfect-week bonus can be disabled for Week 1", () => {
  const result = computeWeeklySettlement(perfectStandings, false);
  assert.equal(result.perfect, false);
  assert.equal(result.amounts.get("first"), 30);
});
