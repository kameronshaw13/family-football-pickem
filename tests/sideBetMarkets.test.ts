import test from "node:test";
import assert from "node:assert/strict";
import { fairMoneylineFromSpread, oppositeAmericanOdds, profitForRisk, sideBetNetForUser, wholeDollarRiskOptions } from "../lib/sideBetMarkets.ts";

test("derives league-specific friendly moneylines from a football spread", () => {
  assert.equal(fairMoneylineFromSpread(-2.5, "CFB"), -120);
  assert.equal(fairMoneylineFromSpread(2.5, "NFL"), 120);
  assert.equal(fairMoneylineFromSpread(-6.5, "CFB"), -200);
  assert.equal(fairMoneylineFromSpread(6.5, "NFL"), 250);
  assert.equal(fairMoneylineFromSpread(0), 100);
});

test("offers risk amounts that produce whole-dollar moneyline winnings", () => {
  assert.deepEqual(wholeDollarRiskOptions(-200, 40), [40, 30, 20, 10]);
  assert.deepEqual(wholeDollarRiskOptions(-150, 20), [18, 15, 9, 3]);
  for (const risk of wholeDollarRiskOptions(-150, 20)) {
    assert.equal(Number.isInteger(profitForRisk(risk, -150)), true);
  }
});

test("every derived football moneyline has at least one clean risk option", () => {
  for (const league of ["CFB", "NFL"] as const) {
    for (let spread = 0.5; spread <= 30; spread += 0.5) {
      const odds = fairMoneylineFromSpread(-spread, league);
      const options = wholeDollarRiskOptions(odds, 20);
      assert.ok(options.length > 0, `${league} ${spread} should have a clean risk option at ${odds}`);
      for (const risk of options) assert.equal(Number.isInteger(profitForRisk(risk, odds)), true);
    }
  }
});

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
