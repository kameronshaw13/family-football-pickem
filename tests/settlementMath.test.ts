import test from "node:test";
import assert from "node:assert/strict";
import { rankedPayoutSettlement, winnerTakeAllSettlement } from "../lib/settlementMath.ts";

test("Caleb weekly winner receives the pot and the remaining players split the loss", () => {
  const standings = [{ user_id: "winner", rank: 1 }, { user_id: "b", rank: 2 }, { user_id: "c", rank: 3 }, { user_id: "d", rank: 4 }];
  const result = winnerTakeAllSettlement(standings, 20);
  assert.equal(result.amounts.get("winner"), 20);
  assert.equal(result.amounts.get("b"), -20 / 3);
  assert.equal(result.amounts.get("c"), -20 / 3);
  assert.equal(result.amounts.get("d"), -20 / 3);
});

test("tied winners split a winner-take-all pot", () => {
  const standings = [{ user_id: "a", rank: 1 }, { user_id: "b", rank: 1 }, { user_id: "c", rank: 3 }, { user_id: "d", rank: 4 }];
  const result = winnerTakeAllSettlement(standings, 20);
  assert.equal(result.amounts.get("a"), 10);
  assert.equal(result.amounts.get("b"), 10);
  assert.equal(result.amounts.get("c"), -10);
  assert.equal(result.amounts.get("d"), -10);
});

test("an all-player season tie creates no winner-take-all payment", () => {
  const result = winnerTakeAllSettlement([{ user_id: "a", rank: 1 }, { user_id: "b", rank: 1 }, { user_id: "c", rank: 1 }], 60);
  assert.deepEqual(Array.from(result.amounts.values()), [0, 0, 0]);
});

test("Friends season ties average the payouts for the occupied places", () => {
  const standings = [{ user_id: "a", rank: 1 }, { user_id: "b", rank: 2 }, { user_id: "c", rank: 2 }, { user_id: "d", rank: 4 }, { user_id: "e", rank: 5 }];
  const result = rankedPayoutSettlement(standings, [150, 50, -30, -70, -100], "season payout");
  assert.equal(result.amounts.get("a"), 150);
  assert.equal(result.amounts.get("b"), 10);
  assert.equal(result.amounts.get("c"), 10);
  assert.equal(result.amounts.get("d"), -70);
  assert.equal(result.amounts.get("e"), -100);
});
