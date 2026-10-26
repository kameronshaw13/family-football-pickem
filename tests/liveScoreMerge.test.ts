import test from "node:test";
import assert from "node:assert/strict";
import { expandGameAliases, mergeLiveScores } from "../lib/liveScoreMerge.ts";

test("scores received on an imported duplicate reach a pick on either game ID", () => {
  const games = [{ id: "espn-1", source_game_ids: ["espn-1", "odds-1"], live_home_score: 0 }];
  const next = mergeLiveScores(games, [{ id: "odds-1", live_home_score: 21 }]);
  const cards = expandGameAliases(next);
  assert.equal(next[0].id, "espn-1");
  assert.equal(cards.find(game => game.id === "odds-1")?.live_home_score, 21);
  assert.equal(cards.find(game => game.id === "espn-1")?.live_home_score, 21);
  assert.equal(games[0].live_home_score, 0);
});

test("an unavailable event preserves its score while other games update", () => {
  const games = [{ id: "nfl", live_home_score: 7 }, { id: "college", live_home_score: 3 }];
  const next = mergeLiveScores(games, [{ id: "nfl", live_home_score: 14 }]);
  assert.equal(next[0].live_home_score, 14);
  assert.equal(next[1], games[1]);
});

test("final scores propagate through aliases without replacing the displayed identity", () => {
  const next = mergeLiveScores([{ id: "board", source_game_ids: ["pick"] }], [{ id: "pick", final_home_score: 24, final_away_score: 21, live_completed: true }]);
  assert.deepEqual(next[0], { id: "board", source_game_ids: ["pick"], final_home_score: 24, final_away_score: 21, live_completed: true });
  assert.equal(expandGameAliases(next).length, 2);
});
