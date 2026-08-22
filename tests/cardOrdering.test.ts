import test from "node:test";
import assert from "node:assert/strict";
import { orderCardPicks } from "../lib/cardOrdering.ts";
import type { Game, Pick } from "../lib/types.ts";

function game(id: string, commenceTime: string): Game {
  return {
    id,
    week: 1,
    league: "CFB",
    commence_time: commenceTime,
    home_team: `${id} home`,
    away_team: `${id} away`,
    home_logo_url: null,
    away_logo_url: null,
    current_spread_team: `${id} home`,
    current_spread: -3,
    current_bookmaker: null,
    lock_time: commenceTime,
    is_locked: false,
    final_home_score: null,
    final_away_score: null
  };
}

function pick(id: string, type: Pick["pick_type"] = "regular", confidencePoints: number | null = null): Pick {
  return {
    id,
    user_id: "player",
    game_id: id,
    week: 1,
    selected_team: `${id} home`,
    pick_type: type,
    status: "draft",
    locked_spread: -3,
    locked_spread_team: `${id} home`,
    locked_at: null,
    underdog_win_value: null,
    confidence_points: confidencePoints,
    result: "pending"
  };
}

const games = [
  game("late", "2026-09-12T23:00:00.000Z"),
  game("early", "2026-09-12T16:00:00.000Z"),
  game("dog", "2026-09-12T15:00:00.000Z")
];

test("standard cards sort regular picks by kickoff and keep the dog last", () => {
  const ordered = orderCardPicks([pick("late"), pick("dog", "underdog"), pick("early")], games, false);
  assert.deepEqual(ordered.map((row) => row.game_id), ["early", "late", "dog"]);
});

test("points cards preserve confidence order and keep the dog last", () => {
  const ordered = orderCardPicks([pick("early", "regular", 1), pick("dog", "underdog"), pick("late", "regular", 5)], games, true);
  assert.deepEqual(ordered.map((row) => row.game_id), ["late", "early", "dog"]);
});
