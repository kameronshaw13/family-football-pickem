import test from "node:test";
import assert from "node:assert/strict";
import { basketballResults, basketballForm } from "../lib/basketballPreviewData.ts";
import { basketballShots, filterBasketballShots } from "../lib/basketballShots.ts";
function event(id: string, own: any, opponent: any, extras: any = {}) {
  return { id, date: "2026-11-01T18:00:00Z", seasonType: { type: 2 }, competitions: [{ status: { type: { completed: true } }, competitors: [
    { homeAway: "away", team: { id: "1", displayName: "Away" }, score: own }, { homeAway: "home", team: { id: "2", displayName: "Home" }, score: opponent }
  ] }], ...extras };
}
test("basketball form excludes future games, preseason, duplicates and missing scores", () => {
  const events = [event("1", { value: 81 }, { displayValue: "77" }), event("1", 81, 77), event("2", null, 70), event("3", 90, 80, { date: "2026-11-03T18:00:00Z" }), event("4", 90, 80, { seasonType: { type: 1 } })];
  const games = basketballResults(events, "1", Date.parse("2026-11-02T18:00:00Z"));
  assert.equal(games.length, 1); assert.equal(games[0].teamPoints, 81); assert.equal(games[0].spread, null);
  assert.deepEqual(basketballForm("1", "Away", null, games).record, { wins: 1, losses: 0 });
  assert.equal(basketballForm("1", "Away", null, games).ats.margin, null);
});
test("basketball ATS uses the selected team's saved spread, preserves zero, and prefers a spread-bearing duplicate", () => {
  const lines = [{ id: "empty", espn_event_id: "1", home_team: "Home", away_team: "Away", current_spread_team: null, current_spread: null }, { id: "line", espn_event_id: "1", home_team: "Home", away_team: "Away", current_spread_team: "Home", current_spread: -4 }];
  const games = basketballResults([event("1", 76, 80)], "1", Infinity, lines);
  assert.equal(games[0].spread, 4); assert.equal(games[0].ats, "P"); assert.equal(games[0].cover, 0);
  assert.equal(basketballForm("1", "Away", null, games).ats.pushes, 1);
});
test("shot chart rejects sentinel, missing, out-of-court and non-field-goal coordinates", () => {
  const shot = { id: "1", shootingPlay: true, pointsAttempted: 2, coordinate: { x: 25, y: 5 }, period: { number: 1 }, scoringPlay: true, team: { id: "1" }, participants: [{ athlete: { id: "7" } }], clock: { displayValue: "12:00" }, awayScore: 0, homeScore: null };
  const shots = basketballShots([shot, { ...shot, coordinate: { x: -214748340, y: -214748365 } }, { ...shot, coordinate: { x: 25, y: 100 } }, { ...shot, coordinate: { x: null, y: 5 } }, { ...shot, shootingPlay: false }, { ...shot, pointsAttempted: 1 }], new Map([["7", "Shooter"]]));
  assert.equal(shots.length, 1); assert.equal(shots[0].player, "Shooter"); assert.equal(shots[0].awayScore, 0); assert.equal(shots[0].homeScore, null);
  assert.equal(filterBasketballShots(shots, "all", "current", 1).length, 1);
  assert.equal(filterBasketballShots(shots, "all", "current", 2).length, 0);
  assert.equal(filterBasketballShots(shots, "all", "all", 2).length, 1);
  assert.equal(filterBasketballShots(shots, "2", "all", 1).length, 0);
});
