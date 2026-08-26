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

test("Friends season ties average the payouts for occupied places and remain zero-sum", () => {
  const standings = [
    { user_id: "a", rank: 1 },
    { user_id: "b", rank: 2 },
    { user_id: "c", rank: 2 },
    { user_id: "d", rank: 4 },
    { user_id: "e", rank: 5 },
    { user_id: "f", rank: 6 },
    { user_id: "g", rank: 7 },
    { user_id: "h", rank: 8 }
  ];
  const result = rankedPayoutSettlement(standings, [200, 100, 50, 0, -50, -75, -100, -125], "season payout");
  assert.equal(result.amounts.get("a"), 200);
  assert.equal(result.amounts.get("b"), 75);
  assert.equal(result.amounts.get("c"), 75);
  assert.equal(result.amounts.get("d"), 0);
  assert.equal(result.amounts.get("e"), -50);
  assert.equal(result.amounts.get("f"), -75);
  assert.equal(result.amounts.get("g"), -100);
  assert.equal(result.amounts.get("h"), -125);
  assert.equal(Array.from(result.amounts.values()).reduce((sum, amount) => sum + amount, 0), 0);
});

test("Friends weekly eight-place ladder is zero-sum and tied places split correctly", () => {
  const standings = [
    { user_id: "a", rank: 1 },
    { user_id: "b", rank: 2 },
    { user_id: "c", rank: 3 },
    { user_id: "d", rank: 3 },
    { user_id: "e", rank: 3 },
    { user_id: "f", rank: 6 },
    { user_id: "g", rank: 7 },
    { user_id: "h", rank: 8 }
  ];
  const result = rankedPayoutSettlement(standings, [40, 20, 0, 0, 0, -10, -20, -30], "weekly payout");
  assert.equal(result.amounts.get("a"), 40);
  assert.equal(result.amounts.get("b"), 20);
  assert.equal(result.amounts.get("c"), 0);
  assert.equal(result.amounts.get("d"), 0);
  assert.equal(result.amounts.get("e"), 0);
  assert.equal(result.amounts.get("f"), -10);
  assert.equal(result.amounts.get("g"), -20);
  assert.equal(result.amounts.get("h"), -30);
  assert.equal(Array.from(result.amounts.values()).reduce((sum, amount) => sum + amount, 0), 0);
});
