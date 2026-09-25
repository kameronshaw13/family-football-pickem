import assert from "node:assert/strict";
import test from "node:test";
import { buildBankHistory } from "../lib/bankHistory.ts";
import type { BankEntry, SideBet } from "../lib/types.ts";

function settled(overrides: Partial<SideBet> & Pick<SideBet, "id" | "game_id" | "week" | "creator_id" | "accepted_by" | "winner_id" | "result" | "amount">): SideBet {
  return {
    creator_team: "Kansas State Wildcats",
    offered_team: "Cincinnati Bearcats",
    creator_spread: 0,
    offered_spread: 0,
    market_type: "moneyline",
    creator_odds: 100,
    status: "settled",
    accepted_at: "2026-09-20T12:00:00.000Z",
    created_at: "2026-09-20T11:00:00.000Z",
    updated_at: "2026-09-20T15:00:00.000Z",
    targets: [],
    ...overrides
  };
}

test("aggregates multiple side bets on the same game when the wager terms match", () => {
  const bets = [
    settled({ id: "a", game_id: "game-1", week: 4, creator_id: "kam", accepted_by: "dad", winner_id: "kam", result: "creator_win", amount: 20 }),
    settled({ id: "b", game_id: "game-1", week: 4, creator_id: "kam", accepted_by: "bro", winner_id: "kam", result: "creator_win", amount: 20 })
  ];

  const history = buildBankHistory([], bets);
  assert.equal(history.length, 1);
  assert.equal(history[0].games.length, 1);
  assert.equal(history[0].games[0].betCount, 2);
  assert.equal(history[0].games[0].betCounts.kam, 2);
  assert.equal(history[0].games[0].betCounts.dad, 1);
  assert.equal(history[0].games[0].betCounts.bro, 1);
  assert.equal(history[0].games[0].amounts.kam, 40);
  assert.equal(history[0].games[0].amounts.dad, -20);
  assert.equal(history[0].games[0].amounts.bro, -20);
});

test("combines weekly bank entries with odds-adjusted side bet results", () => {
  const entries: BankEntry[] = [
    { id: "e1", week: 5, user_id: "kam", amount: 30, note: "Week winner" },
    { id: "e2", week: 5, user_id: "dad", amount: -30, note: "Last place" }
  ];
  const bets = [
    settled({
      id: "c",
      game_id: "game-2",
      week: 5,
      creator_id: "kam",
      accepted_by: "dad",
      winner_id: "kam",
      result: "creator_win",
      amount: 40,
      creator_odds: -200
    })
  ];

  const [week] = buildBankHistory(entries, bets);
  assert.equal(week.weeklyAmounts.kam, 30);
  assert.equal(week.games[0].amounts.kam, 20);
  assert.equal(week.games[0].amounts.dad, -20);
  assert.equal(week.totals.kam, 50);
  assert.equal(week.totals.dad, -50);
});


test("keeps different markets and odds as separate bank-history rows", () => {
  const bets = [
    settled({
      id: "ml",
      game_id: "falcons",
      week: 5,
      creator_id: "kam",
      accepted_by: "dad",
      winner_id: "kam",
      result: "creator_win",
      amount: 20,
      creator_team: "Atlanta Falcons",
      offered_team: "Tampa Bay Buccaneers",
      market_type: "moneyline",
      creator_spread: 0,
      offered_spread: 0,
      creator_odds: 120
    }),
    settled({
      id: "spread",
      game_id: "falcons",
      week: 5,
      creator_id: "kam",
      accepted_by: "dad",
      winner_id: "kam",
      result: "creator_win",
      amount: 20,
      creator_team: "Atlanta Falcons",
      offered_team: "Tampa Bay Buccaneers",
      market_type: "spread",
      creator_spread: 5.5,
      offered_spread: -5.5,
      creator_odds: -110
    }),
    settled({
      id: "ml-2",
      game_id: "falcons",
      week: 5,
      creator_id: "kam",
      accepted_by: "bro",
      winner_id: "kam",
      result: "creator_win",
      amount: 20,
      creator_team: "Atlanta Falcons",
      offered_team: "Tampa Bay Buccaneers",
      market_type: "moneyline",
      creator_spread: 0,
      offered_spread: 0,
      creator_odds: 130
    })
  ];

  const [week] = buildBankHistory([], bets);
  assert.equal(week.games.length, 3);
  assert.deepEqual(week.games.map(row => row.selections.kam.marketType).sort(), ["moneyline", "moneyline", "spread"]);
  assert.deepEqual(week.games.map(row => row.selections.kam.odds).sort((a, b) => a - b), [-110, 120, 130]);
});
