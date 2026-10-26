import test from "node:test";
import assert from "node:assert/strict";
import { playerProfileStats } from "../lib/playerProfileStats.ts";

test("profile distinguishes sport spread records from dog bonus wins", () => {
  const result = playerProfileStats([
    { pick_type: "regular", result: "win", game: { league: "NFL" } },
    { pick_type: "regular", result: "push", game: { league: "NFL" } },
    { pick_type: "regular", result: "loss", game: { league: "CFB" } },
    { pick_type: "underdog", result: "win", game: { league: "CFB" }, locked_spread: 12.5 },
    { pick_type: "underdog", result: "loss", locked_spread: 7 },
    { pick_type: "underdog", result: "pending", locked_spread: 20 }
  ], [], "a");
  assert.deepEqual(result.leagues.find(row => row.league === "NFL"), { league: "NFL", wins: 1, losses: 0, pushes: 1, winPct: 1 });
  assert.deepEqual(result.dogs, { wins: 1, attempts: 2, bonusWins: 2 });
});

test("profile side bet extremes respect odds, perspective, pushes and unsettled bets", () => {
  const base = { creator_id: "a", accepted_by: "b", amount: 20, creator_odds: 150, status: "settled", winner_id: "a", result: "creator_win" };
  const result = playerProfileStats([], [base, { ...base, winner_id: "b", result: "opponent_win" }, { ...base, result: "push", winner_id: null }, { ...base, status: "accepted" }, { ...base, creator_id: "c", accepted_by: "d" }], "b");
  assert.deepEqual(result.sideBets, { settled: 3, winPct: 0.5, biggestWin: 20, biggestLoss: -30 });
});

test("empty profile has no invented percentage or sport history", () => {
  const result = playerProfileStats([], [], "a");
  assert.deepEqual(result.leagues, []);
  assert.deepEqual(result.dogs, { wins: 0, attempts: 0, bonusWins: 0 });
  assert.equal(result.sideBets.winPct, null);
});
