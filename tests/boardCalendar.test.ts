import test from "node:test";
import assert from "node:assert/strict";
import type { Game } from "../lib/types.ts";
import { boardCalendar, boardGameOrder, boardLeagueGroups, favoriteGameKey, legacyFavoriteGameKey, sortBoardGames } from "../lib/boardCalendar.ts";

const game = (id: string, league: string, commence_time: string, extra: Partial<Game> = {}) => ({
  id, league, week: 4, commence_time, home_team: "Home", away_team: "Away",
  ...extra
} as Game);

test("football calendar starts Tuesday; chosen day survives when inside selected week", () => {
  const games = [game("f1", "CFB", "2026-11-25T18:00:00Z")];
  const clock = Date.parse("2026-11-25T18:00:00Z");
  const calendar = boardCalendar({ games, clock, week: 4, currentWeek: 4, basketball: false, rules: {}, selectedDay: "2026-11-27" });
  assert.equal(calendar.calendarDays[0], "2026-11-24");
  assert.equal(calendar.calendarDays[6], "2026-11-30");
  assert.equal(calendar.selectedDayKey, "2026-11-27");
  const outside = boardCalendar({ games, clock, week: 4, currentWeek: 4, basketball: false, rules: {}, selectedDay: "2026-12-05" });
  assert.equal(outside.selectedDayKey, outside.todayDayKey);
});

test("basketball calendar honors basketball's week boundaries and current day", () => {
  const games = [game("b1", "CBB", "2026-11-24T18:00:00Z")];
  const clock = Date.parse("2026-11-24T18:00:00Z");
  const calendar = boardCalendar({ games, clock, week: 4, currentWeek: 4, basketball: true, rules: {} });
  assert.equal(calendar.calendarDays[0], "2026-11-23");
  assert.equal(calendar.calendarDays[6], "2026-11-29");
  assert.equal(calendar.selectedDayKey, "2026-11-24");
});

test("broadcast board ordering keeps active before finals before upcoming", () => {
  const clock = Date.parse("2026-11-25T18:00:00Z");
  const live = game("live", "CFB", "2026-11-25T17:00:00Z", { live_state: "in" });
  const final = game("final", "CFB", "2026-11-25T15:00:00Z", { live_state: "post", final_away_score: 7, final_home_score: 10 });
  const future = game("future", "CFB", "2026-11-26T17:00:00Z");
  assert.equal(boardGameOrder(live, clock), 0);
  assert.equal(boardGameOrder(final, clock), 1);
  assert.equal(boardGameOrder(future, clock), 2);
  assert.deepEqual(sortBoardGames([future, final, live], clock).map(g => g.id), ["live", "final", "future"]);
});

test("favorite identity is stable under schedule and internal id changes", () => {
  const original = game("original", "NBA", "2026-11-25T17:00:00Z");
  const moved = game("replaced", "NBA", "2026-11-26T17:00:00Z");
  assert.equal(favoriteGameKey(original), favoriteGameKey(moved));
  assert.notEqual(legacyFavoriteGameKey(original), legacyFavoriteGameKey(moved));
});

test("college and pro league sections retain their original order for ties", () => {
  const clock = Date.parse("2026-11-25T16:00:00Z");
  const games = [game("nba", "NBA", "2026-11-27T17:00:00Z"), game("cbb", "CBB", "2026-11-27T17:00:00Z")];
  assert.deepEqual(boardLeagueGroups(games, true, clock).map(group => group.league), ["CBB", "NBA"]);
});
