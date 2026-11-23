import test from "node:test";
import assert from "node:assert/strict";
import type { Game, Pick } from "../lib/types.ts";
import { pickSaveRequest, attachSavedPickGames, reconcileSavedPicks } from "../lib/pickSaveClient.ts";

const game = (id: string, home_team: string) => ({ id, home_team } as Game);
const pick = (id: string, user_id: string, week: number, game_id: string, extras: Partial<Pick> = {}) => ({
  id, user_id, week, game_id, selected_team: "Home", pick_type: "regular", ...extras
} as Pick);

test("pick save retains week, league auth, pick types and confidence points", () => {
  const card = [pick("p1", "u1", 5, "game-a", { confidence_points: 4 }), pick("p2", "u1", 5, "game-b", { pick_type: "underdog" })];
  const { url, init } = pickSaveRequest("token", "friends-basketball", 5, card);
  assert.equal(url, "/api/picks");
  assert.equal(init.method, "POST");
  assert.deepEqual(init.headers, {
    "Content-Type": "application/json", Authorization: "Bearer token", "x-pickem-group": "friends-basketball"
  });
  assert.deepEqual(JSON.parse(init.body), {
    action: "saveCard", week: 5,
    picks: [
      { gameId: "game-a", selectedTeam: "Home", pickType: "regular", confidencePoints: 4 },
      { gameId: "game-b", selectedTeam: "Home", pickType: "underdog", confidencePoints: null }
    ]
  });
});

test("saved pick games resolve to current canonical game and preserve fallback", () => {
  const oldGame = game("a", "Old");
  const newGame = game("a", "New");
  const card = [pick("1", "u1", 4, "a", { game: oldGame }), pick("2", "u1", 4, "absent", { game: oldGame })];
  const result = attachSavedPickGames(card, [newGame]);
  assert.equal(result[0].game, newGame);
  assert.equal(result[1].game, oldGame);
  assert.equal(card[0].game, oldGame);
});

test("reconciling saves preserves other users and historical weeks", () => {
  const games = [game("a", "Current")];
  const existing = [
    pick("mine-old", "u1", 4, "a"),
    pick("other", "u2", 4, "a"),
    pick("mine-last-week", "u1", 3, "a")
  ];
  const current = { currentUser: { id: "u1" }, week: 4, games, picks: existing, bankBalances: { u1: 50 } };
  const result = reconcileSavedPicks(current, [pick("mine-new", "u1", 4, "a")]);
  assert.deepEqual(result.picks.map(p => p.id), ["other", "mine-last-week", "mine-new"]);
  assert.equal(result.picks[2].game, games[0]);
  assert.deepEqual(result.bankBalances, { u1: 50 });
  assert.deepEqual(current.picks, existing);
});
