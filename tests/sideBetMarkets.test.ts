import test from "node:test";
import assert from "node:assert/strict";
import { fairAltSpreadOdds, fairAltTotalOdds, fairMoneylineFromSpread, oppositeAmericanOdds, profitForRisk, sideBetNetForUser } from "../lib/sideBetMarkets.ts";

test("derives league-specific fair rounded moneylines from a football spread", () => {
  assert.equal(fairMoneylineFromSpread(-1.5, "CFB"), -110);
  assert.equal(fairMoneylineFromSpread(-2.5, "CFB"), -125);
  assert.equal(fairMoneylineFromSpread(2.5, "NFL"), 125);
  assert.equal(fairMoneylineFromSpread(-6.5, "CFB"), -200);
  assert.equal(fairMoneylineFromSpread(6.5, "NFL"), 250);
  assert.equal(fairMoneylineFromSpread(0), 100);
});

test("every derived football moneyline is a valid whole-number price", () => {
  for (const league of ["CFB", "NFL"] as const) {
    for (let spread = 0.5; spread <= 30; spread += 0.5) {
      const favorite = fairMoneylineFromSpread(-spread, league);
      const underdog = fairMoneylineFromSpread(spread, league);
      assert.equal(Number.isInteger(favorite), true);
      assert.equal(underdog, Math.abs(favorite) === 100 ? 100 : -favorite);
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


test("prices alternate spreads from an even-money market line", () => {
  assert.equal(fairAltSpreadOdds(-4.5, -4.5), 100);
  assert.equal(fairAltSpreadOdds(-4.5, -4), -110);
  assert.equal(fairAltSpreadOdds(-4.5, -3.5), -120);
  assert.equal(fairAltSpreadOdds(-4.5, -5.5), 120);
  assert.equal(fairAltSpreadOdds(4.5, 5.5), -120);
  assert.equal(fairAltSpreadOdds(4.5, 3.5), 120);
});

test("prices alternate totals from the selected over or under side", () => {
  assert.equal(fairAltTotalOdds(52.5, 52.5, "over"), 100);
  assert.equal(fairAltTotalOdds(52.5, 51.5, "over"), -120);
  assert.equal(fairAltTotalOdds(52.5, 53.5, "over"), 120);
  assert.equal(fairAltTotalOdds(52.5, 53.5, "under"), -120);
  assert.equal(fairAltTotalOdds(52.5, 51.5, "under"), 120);
});


test("anchors alternate spreads to the de-vigged market moneyline", () => {
  const options = { teamMoneylineOdds: 160, opponentMoneylineOdds: -190, league: "CFB" as const };
  const nearMoneyline = fairAltSpreadOdds(3.5, 0.5, options);
  const harderThanMoneyline = fairAltSpreadOdds(3.5, -1.5, options);
  assert.ok(nearMoneyline >= 150);
  assert.ok(harderThanMoneyline > nearMoneyline);
  assert.ok(harderThanMoneyline > 160);
});

test("NFL and CFB alternate spread curves treat key numbers differently", () => {
  const nfl = fairAltSpreadOdds(-3.5, -2.5, { teamMoneylineOdds: -200, opponentMoneylineOdds: 170, league: "NFL" });
  const cfb = fairAltSpreadOdds(-3.5, -2.5, { teamMoneylineOdds: -200, opponentMoneylineOdds: 170, league: "CFB" });
  assert.equal(nfl, -140);
  assert.equal(cfb, -130);
});
