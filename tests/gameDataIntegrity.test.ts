import test from "node:test";
import assert from "node:assert/strict";
import { selectGameLine, selectGameFinal } from "../lib/gameDataIntegrity.ts";
import { dedupeLocalGames, mergeLocalGameRows, type LocalGame } from "../lib/cfbMatchupData.ts";
import { trackerNumber, trackerPlaySituation } from "../lib/trackerPlaySituation.ts";
import { normalizeSpreadForSelectedTeam } from "../lib/spreads.ts";

const base: LocalGame = { id: "dk", week: 5, home_team: "Detroit Lions", away_team: "New York Jets", commence_time: "2026-09-27T17:00:00Z", current_spread_team: "Detroit Lions", current_spread: -6.5, current_bookmaker: "DraftKings", final_home_score: 31, final_away_score: 24, updated_at: "2026-09-27T20:00:00Z" };

test("DraftKings wins over a later consensus row in either import order", () => {
  const market = { ...base, id: "market", current_bookmaker: "Market", current_spread: -7, updated_at: "2026-09-30T20:00:00Z" };
  assert.equal(selectGameLine(base, market)?.id, "dk");
  assert.equal(selectGameLine(market, base)?.id, "dk");
  const override = { ...market, id: "manual", current_bookmaker: "Manual Week 5 override · DraftKings", current_spread: -3.5 };
  assert.equal(selectGameLine(base, override)?.id, "manual");
});

test("invalid lines and incomplete or negative scores cannot erase valid data", () => {
  const invalid: LocalGame = { ...base, id: "bad", updated_at: "2026-10-01T00:00Z", current_spread_team: "Other Team", current_spread: NaN, final_home_score: null, final_away_score: 27 };
  assert.equal(selectGameLine(base, invalid)?.id, "dk");
  assert.equal(selectGameFinal(base, invalid)?.id, "dk");
  assert.equal(selectGameFinal({ ...invalid, final_home_score: -1 }, invalid), null);
  assert.equal(selectGameFinal({ ...base, final_home_score: 0, final_away_score: 0 }, invalid)?.final_home_score, 0);
});

test("merging three duplicates retains the line source timestamp separately from score refreshes", () => {
  const score = { ...base, id: "score", current_spread: null, current_spread_team: null, updated_at: "2026-10-01T00:00Z" };
  const newerLine = { ...base, id: "new-line", current_spread: -7, updated_at: "2026-09-28T00:00Z" };
  const merged = mergeLocalGameRows(mergeLocalGameRows(base, score), newerLine);
  assert.equal(merged.current_spread, -7);
  assert.equal(merged.final_home_score, 31);
  assert.equal(merged.spread_source_updated_at, newerLine.updated_at);
});

test("score selection keeps one complete pair and uses the newer valid source", () => {
  const newer = { ...base, id: "corrected", updated_at: "2026-09-28T00:00Z", final_home_score: 35, final_away_score: 21 };
  assert.equal(selectGameFinal(base, newer)?.id, "corrected");
  assert.equal(selectGameFinal(newer, base)?.id, "corrected");
});

test("missing tracker numbers stay missing while real zeroes remain zero", () => {
  for (const value of [null, undefined, "", " ", false, [], NaN, Infinity]) assert.equal(trackerNumber(value), null);
  assert.equal(trackerNumber(0), 0);
  assert.equal(trackerNumber("0"), 0);
});

test("kickoff uses the named kicking yard line rather than the receiving drive", () => {
  assert.equal(trackerPlaySituation({ type: { text: "Kickoff" }, text: "A.Borregales kicks 54 yards from NE 35 to BUF 11.", start: { yardLine: 65 } }), "NE 35");
  assert.equal(trackerPlaySituation({ type: { text: "Kickoff" }, text: "Kickoff", start: { team: { id: "17" }, yardsToEndzone: 65 } }, { "17": "NE", "2": "BUF" }), "NE 35");
  assert.equal(trackerPlaySituation({ type: { text: "Kickoff" }, text: "kicks from TAMU 35 to LSU 5" }), "TAMU 35");
  assert.equal(trackerPlaySituation({ type: { text: "Kickoff" }, start: { yardLine: 65 } }), "");
  assert.equal(trackerPlaySituation({ start: { downDistanceText: "1st & 10 at NE 25" } }), "1st & 10 at NE 25");
});

test("App State aliases merge into a single form game without losing the spread", () => {
  const a = { ...base, id: "espn", home_team: "App State Mountaineers", away_team: "James Madison Dukes", current_spread: null, current_spread_team: null };
  const b = { ...a, id: "action", home_team: "Appalachian State Mountaineers", current_spread: -12.5, current_spread_team: "James Madison Dukes" };
  const rows = dedupeLocalGames([a,b]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].current_spread, -12.5);
  assert.equal(normalizeSpreadForSelectedTeam("App State Mountaineers", "Appalachian State Mountaineers", 12.5), 12.5);
});
