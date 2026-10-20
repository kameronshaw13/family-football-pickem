import test from "node:test";
import assert from "node:assert/strict";
import { money, roundedMoney, stakeMoney, normalizeRiskInput } from "../lib/moneyDisplay.ts";
import { sideBetMarketText, sideBetOddsForTeam, sideBetLineText } from "../lib/sideBetDisplay.ts";
import { confidencePointText, dogBonusText } from "../lib/pickDisplay.ts";

test("money display preserves existing signed dollar representation", () => {
  assert.equal(money(12), "+$12");
  assert.equal(money(-1.5), "-$1.50");
  assert.equal(money(0), "$0");
  assert.equal(roundedMoney(10.7), "+$11");
  assert.equal(stakeMoney(20), "$20");
  assert.equal(stakeMoney(12.5), "$12.50");
});

test("stake entry normalization preserves two decimal places", () => {
  assert.equal(normalizeRiskInput("$1,234.567"), "1234.56");
  assert.equal(normalizeRiskInput(".5"), "0.5");
  assert.equal(normalizeRiskInput("20"), "20");
});

test("spread, total and moneyline rendering remains unchanged", () => {
  assert.equal(sideBetMarketText("moneyline", null, 100), "ML");
  assert.equal(sideBetMarketText("moneyline", null, -125), "ML -125");
  assert.equal(sideBetMarketText("total", null, 100, 51.5, "under"), "U 51.5");
  const bet = { creator_team: "Texas", creator_odds: 125, creator_spread: -3.5, offered_spread: 3.5, market_type: "spread" };
  assert.equal(sideBetOddsForTeam(bet as never, "Texas"), 125);
  assert.equal(sideBetLineText(bet as never, "Texas"), "-3.5 +125");
});

test("pick labels retain pluralization", () => {
  assert.equal(confidencePointText(1), "1 pt");
  assert.equal(confidencePointText(3), "3 pts");
  assert.equal(dogBonusText(1, true), "+1 Pt");
  assert.equal(dogBonusText(2, false), "+2W");
});

import { sideBetMatchesGameFilter, sortSideBetsGroupedByGame } from "../lib/sideBetSorting.ts";

test("side-bet ledger keeps upcoming first, completed at the bottom, and grouped games together", () => {
  const items = [
    { id: "b2", game_id: "g1", created_at: "2026-10-19T10:02:00Z", status: "accepted", game: { commence_time: "2026-10-24T18:00:00Z" } },
    { id: "b3", game_id: "g2", created_at: "2026-10-19T10:03:00Z", status: "settled", updated_at: "2026-10-19T12:00:00Z", game: { commence_time: "2026-10-17T18:00:00Z", live_completed: true } },
    { id: "b1", game_id: "g1", created_at: "2026-10-19T10:01:00Z", status: "accepted", game: { commence_time: "2026-10-24T18:00:00Z" } }
  ];
  assert.deepEqual(sortSideBetsGroupedByGame(items as never).map(b => b.id), ["b1", "b2", "b3"]);
  assert.equal(sideBetMatchesGameFilter(items[1] as never, "completed"), true);
  assert.equal(sideBetMatchesGameFilter(items[0] as never, "upcoming"), true);
});
