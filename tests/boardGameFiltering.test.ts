import test from "node:test";
import assert from "node:assert/strict";
import type { Game } from "../lib/types.ts";
import { filterBoardGames } from "../lib/boardGameFiltering.ts";

const makeGame = (id: string, league: string, extras: Partial<Game> = {}) => ({
  id, league, week: 4, away_team: "Away", home_team: "Home",
  commence_time: "2026-11-28T18:00:00Z", ...extras
} as Game);

const create = (games: Game[], overrides: Partial<Parameters<typeof filterBoardGames>[0]> = {}) =>
  filterBoardGames({
    games, active: true, basketball: false,
    leagueFilter: "ALL", conferenceFilter: "ALL", cbbConferenceFilter: "ALL",
    dogValueFilter: "ALL", matchesFootballConference: () => true,
    matchesBasketballConference: () => true,
    dogValueForTeam: () => 0,
    ...overrides
  });

test("football All keeps college and pro, basketball All keeps college and pro", () => {
  const games = [makeGame("cfb", "CFB"), makeGame("nfl", "NFL"), makeGame("cbb", "CBB"), makeGame("nba", "NBA")];
  assert.deepEqual(create(games).map(game => game.id), ["cfb", "nfl"]);
  assert.deepEqual(create(games, { basketball: true }).map(game => game.id), ["cbb", "nba"]);
  assert.deepEqual(create(games, { active: false }), []);
});

test("filtering a college conference excludes pro when conference selected", () => {
  const games = [makeGame("cfb", "CFB"), makeGame("nfl", "NFL")];
  assert.deepEqual(create(games, { conferenceFilter: "POWER4" }).map(game => game.id), ["cfb"]);
  assert.deepEqual(create(games, { conferenceFilter: "POWER4", matchesFootballConference: () => false }), []);
  const bball = [makeGame("cbb", "CBB"), makeGame("nba", "NBA")];
  assert.deepEqual(create(bball, { basketball: true, cbbConferenceFilter: "Big 12" }).map(game => game.id), ["cbb"]);
});

test("explicit pro league and dogs retain their selections", () => {
  const games = [makeGame("cfb", "CFB"), makeGame("nfl", "NFL")];
  assert.deepEqual(create(games, { leagueFilter: "NFL" }).map(game => game.id), ["nfl"]);
  assert.deepEqual(create(games, { leagueFilter: "DOGS", dogValueFilter: "2", dogValueForTeam: (_, team) => team === "Away" ? 2 : 0 }).map(game => game.id), ["cfb", "nfl"]);
  assert.deepEqual(create(games, { leagueFilter: "DOGS", dogValueFilter: "3", dogValueForTeam: () => 2 }), []);
});

test("rescheduled duplicate is hidden only if replacement with same league and event exists", () => {
  const games = [
    makeGame("old", "CFB", { event_status: "STATUS_RESCHEDULED", espn_event_id: "123" }),
    makeGame("new", "CFB", { espn_event_id: "123" }),
    makeGame("other-sport", "NFL", { espn_event_id: "123" }),
    makeGame("unmatched", "CFB", { event_status: "STATUS_RESCHEDULED", espn_event_id: "456" })
  ];
  assert.deepEqual(create(games).map(game => game.id), ["new", "other-sport", "unmatched"]);
});

test("only duplicate final results are collapsed, while open matchups remain independent", () => {
  const final = { final_away_score: 12, final_home_score: 10 };
  const games = [
    makeGame("a", "CFB", final), makeGame("b", "CFB", final),
    makeGame("c", "CFB"), makeGame("d", "CFB")
  ];
  assert.deepEqual(create(games).map(game => game.id), ["a", "c", "d"]);
  assert.equal(games.length, 4);
});
