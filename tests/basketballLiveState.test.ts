import test from "node:test";
import assert from "node:assert/strict";
import { basketballLiveState } from "../lib/basketballLiveState.ts";

test("a rebound changes possession and becomes the latest action", () => {
  const state = basketballLiveState([
    { id: "1", team: { id: "home" }, type: { text: "Jump Shot" }, text: "Home misses", shootingPlay: true, scoringPlay: false },
    { id: "2", team: { id: "away" }, type: { text: "Defensive Rebound" }, text: "Away rebound", period: { number: 2 }, clock: { displayValue: "4:32" } }
  ], "away", "home");
  assert.equal(state.possessionSide, "away");
  assert.equal(state.latestAction?.text, "Away rebound");
});

test("a missed shot with no rebound leaves possession unknown", () => {
  const state = basketballLiveState([
    { id: "1", team: { id: "home" }, type: { text: "Jump Shot" }, text: "Home makes", shootingPlay: true, scoringPlay: true, scoreValue: 2 },
    { id: "2", team: { id: "away" }, type: { text: "Jump Shot" }, text: "Away misses", shootingPlay: true, scoringPlay: false }
  ], "away", "home");
  assert.equal(state.possessionSide, null);
});

test("made baskets and turnovers send the ball to the other team", () => {
  assert.equal(basketballLiveState([{ team: { id: "home" }, type: { text: "Layup Shot" }, text: "Home makes", shootingPlay: true, scoringPlay: true, scoreValue: 2 }], "away", "home").possessionSide, "away");
  assert.equal(basketballLiveState([{ team: { id: "away" }, type: { text: "Bad Pass Turnover" }, text: "Away turnover" }], "away", "home").possessionSide, "home");
});

test("substitutions do not replace the latest basketball action", () => {
  const state = basketballLiveState([
    { id: "1", team: { id: "away" }, type: { text: "Defensive Rebound" }, text: "Away rebound" },
    { id: "2", team: { id: "home" }, type: { text: "Substitution" }, text: "Player enters" }
  ], "away", "home");
  assert.equal(state.latestAction?.text, "Away rebound");
  assert.equal(state.possessionSide, "away");
});
