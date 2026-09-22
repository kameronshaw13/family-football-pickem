import test from "node:test";
import assert from "node:assert/strict";
import { oppositeAmericanOdds, profitForRisk, sideBetNetForUser } from "../lib/sideBetMarkets.ts";

test("-200 risks 40 to win 20 and gives the other side +200", () => {
  assert.equal(profitForRisk(40, -200), 20);
  assert.equal(oppositeAmericanOdds(-200), 200);
});

test("+200 risks 20 to win 40", () => {
  assert.equal(profitForRisk(20, 200), 40);
  assert.equal(oppositeAmericanOdds(200), -200);
});

test("side bet settlement stays zero-sum at -200", () => {
  const base = {
    creator_id: "creator",
    accepted_by: "acceptor",
    amount: 40,
    creator_odds: -200,
    status: "settled"
  };
  assert.equal(sideBetNetForUser({ ...base, winner_id: "creator", result: "creator_win" }, "creator"), 20);
  assert.equal(sideBetNetForUser({ ...base, winner_id: "creator", result: "creator_win" }, "acceptor"), -20);
  assert.equal(sideBetNetForUser({ ...base, winner_id: "acceptor", result: "acceptor_win" }, "creator"), -40);
  assert.equal(sideBetNetForUser({ ...base, winner_id: "acceptor", result: "acceptor_win" }, "acceptor"), 40);
});
