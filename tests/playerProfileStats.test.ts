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

test("biggest win and loss combine all settled bets on the same game", () => {
  const base = { creator_id: "a", accepted_by: "b", amount: 20, creator_odds: 150, status: "settled", winner_id: "a", result: "creator_win" };
  const bets = [
    { ...base, game_id: "game-1" },
    { ...base, accepted_by: "c", game_id: "game-1" },
    { ...base, winner_id: "b", result: "opponent_win", game_id: "game-1" },
    { ...base, amount: 25, winner_id: "b", result: "opponent_win", game_id: "game-2" },
    { ...base, amount: 25, accepted_by: "d", winner_id: "d", result: "opponent_win", game_id: "game-2" },
    { ...base, amount: 100, status: "accepted", game_id: "game-1" }
  ];
  const result = playerProfileStats([], bets, "a");
  assert.equal(result.sideBets.biggestWin, 40);
  assert.equal(result.sideBets.biggestLoss, -50);
});

test("duplicate imported rows for one event share one game net", () => {
  const game = { league: "NFL", commence_time: "2026-10-25T17:00:00Z", home_team: "Home", away_team: "Away" };
  const base = { creator_id: "a", accepted_by: "b", amount: 10, status: "settled", winner_id: "a", result: "creator_win" };
  const result = playerProfileStats([], [
    { ...base, game_id: "espn-row", game: { ...game, espn_event_id: "123" } },
    { ...base, game_id: "odds-row", game }
  ], "a");
  assert.equal(result.sideBets.biggestWin, 20);
});
