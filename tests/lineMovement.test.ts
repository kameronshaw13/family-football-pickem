import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSpreadForSelectedTeam } from "../lib/spreads.ts";
import { buildLineMovement } from "../lib/lineMovement.ts";
import { mergeLocalGameRows, dedupeLocalGames, type LocalGame } from "../lib/cfbMatchupData.ts";

test("line history normalizes both sides, ignores unchanged refreshes and preserves reversals", () => {
  const rows = [
    { id: "a", spread_team: "Away", spread: -3, created_at: "2026-10-20T12:00:00Z" },
    { id: "b", spread_team: "Home", spread: 3, created_at: "2026-10-20T13:00:00Z" },
    { id: "c", spread_team: "Away", spread: -3.5, created_at: "2026-10-21T12:00:00Z" },
    { id: "d", spread_team: "Away", spread: -3, created_at: "2026-10-22T12:00:00Z" }
  ];
  const result = buildLineMovement(rows.reverse(), "Away");
  assert.equal(result.length, 3);
  assert.deepEqual(result.map(point => point.awaySpread), [-3, -3.5, -3]);
  assert.deepEqual(result.map(point => point.change), [null, -.5, .5]);
});

test("a scored duplicate cannot erase a verified historical spread", () => {
  const base: LocalGame = { id: "espn", espn_event_id: "123", week: 5, commence_time: "2026-09-27T17:00:00Z", away_team: "Carolina Panthers", home_team: "Cleveland Browns", current_spread: null, current_spread_team: null, final_home_score: 21, final_away_score: 18 };
  const line = { ...base, id: "odds", espn_event_id: null, current_spread: -2.5, current_spread_team: "Carolina Panthers", final_home_score: null, final_away_score: null };
  for (const rows of [[base, line], [line, base]]) {
    const result = dedupeLocalGames(rows)[0];
    assert.equal(result.current_spread, -2.5);
    assert.equal(result.final_home_score, 21);
    assert.equal(result.final_away_score, 18);
    assert.equal(result.espn_event_id, "123");
  }
});

test("history merge preserves a pick'em line and adopts a newer complete score", () => {
  const base: LocalGame = { id: "one", week: 1, commence_time: "2026-09-12T17:00:00Z", home_team: "Home", away_team: "Away", current_spread_team: "Away", current_spread: 7, final_home_score: null, final_away_score: null, updated_at: "2026-09-12T17:00:00Z" };
  const next = mergeLocalGameRows(base, { ...base, id: "two", current_spread_team: null, current_spread: null, final_home_score: 24, final_away_score: 20, updated_at: "2026-09-13T00:00:00Z" });
  assert.equal(next.current_spread, 7);
  assert.equal(next.final_home_score, 24);
});


test("team punctuation aliases cannot reverse the displayed spread", () => {
  assert.equal(normalizeSpreadForSelectedTeam("Hawaii Rainbow Warriors", "Hawai'i Rainbow Warriors", -3.5), -3.5);
  assert.equal(normalizeSpreadForSelectedTeam("Northern Illinois Huskies", "Hawai'i Rainbow Warriors", -3.5), 3.5);
  assert.equal(normalizeSpreadForSelectedTeam("Hawaii Rainbow Warriors", "Hawaii Rainbow Warriors", NaN), null);
});
