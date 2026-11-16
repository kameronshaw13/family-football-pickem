import test from "node:test";
import assert from "node:assert/strict";
import { basketballSummarySwapped, orientBasketballPlayScores } from "../lib/basketballSummaryOrientation.ts";

test("neutral-site summary scores and play scores follow the saved team names", () => {
  const game = { home_team: "Marquette Golden Eagles", away_team: "Missouri Tigers" };
  const home = { team: { displayName: "Missouri Tigers" } };
  const away = { team: { displayName: "Marquette Golden Eagles" } };
  assert.equal(basketballSummarySwapped(game, home, away), true);
  assert.deepEqual(orientBasketballPlayScores({ homeScore: 69, awayScore: 64 }, true), { homeScore: 64, awayScore: 69 });
  assert.equal(basketballSummarySwapped(game, away, home), false);
});
