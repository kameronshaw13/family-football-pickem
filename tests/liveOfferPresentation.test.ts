import test from "node:test";
import assert from "node:assert/strict";
import type { Game, SideBet } from "../lib/types.ts";
import { hasRecentlyStartedGames, changedLiveOfferScores } from "../lib/liveOfferPresentation.ts";

const clock = Date.parse("2026-11-23T20:00:00Z");
const game = (id: string, fields: Partial<Game> = {}) => ({
  id, commence_time: "2026-11-23T19:00:00Z", final_home_score: null,
  final_away_score: null, live_completed: false, event_status: null,
  ...fields
} as Game);
const bet = (id: string, fields: Partial<SideBet> = {}) => ({
  id, game_id: "g1", status: "open", offer_phase: "live",
  live_offer_home_score: 7, live_offer_away_score: 3, ...fields
} as SideBet);

test("active game detection only includes unfinished recent, non-postponed games", () => {
  assert.equal(hasRecentlyStartedGames(undefined, clock), false);
  assert.equal(hasRecentlyStartedGames([], clock), false);
  assert.equal(hasRecentlyStartedGames([game("g1")], clock), true);
  assert.equal(hasRecentlyStartedGames([game("future", { commence_time: "2026-11-23T21:00:00Z" })], clock), false);
  assert.equal(hasRecentlyStartedGames([game("old", { commence_time: "2026-11-22T00:00:00Z" })], clock), false);
  assert.equal(hasRecentlyStartedGames([game("final", { final_home_score: 0 })], clock), false);
  assert.equal(hasRecentlyStartedGames([game("completed", { live_completed: true })], clock), false);
  assert.equal(hasRecentlyStartedGames([game("postponed", { event_status: "STATUS_POSTPONED" })], clock), false);
});

test("live-offer score mismatch returns exact visible score information, including zero", () => {
  const games = [game("g1", { live_home_score: 0, live_away_score: 10 })];
  assert.deepEqual(changedLiveOfferScores([bet("offer1")], games), [
    { sideBetId: "offer1", visibleLiveHomeScore: 0, visibleLiveAwayScore: 10 }
  ]);
});

test("unchanged or unknown live scores never flag an offer for expiry", () => {
  const games = [game("g1", { live_home_score: 7, live_away_score: 3 })];
  assert.deepEqual(changedLiveOfferScores([bet("same")], games), []);
  assert.deepEqual(changedLiveOfferScores([bet("missing", { live_offer_home_score: null })], games), []);
  assert.deepEqual(changedLiveOfferScores([bet("unknown")], [game("g1", { live_home_score: null })]), []);
  assert.deepEqual(changedLiveOfferScores([bet("notfound", { game_id: "other" })], games), []);
});

test("only open live offers can be considered for refresh-driven expiry", () => {
  const games = [game("g1", { live_home_score: 9, live_away_score: 3 })];
  const bets = [
    bet("a"), bet("b", { offer_phase: "pregame" }),
    bet("c", { status: "accepted" }), bet("d", { status: "settled" })
  ];
  assert.deepEqual(changedLiveOfferScores(bets, games).map(row => row.sideBetId), ["a"]);
  assert.equal(bets[0].status, "open");
});
