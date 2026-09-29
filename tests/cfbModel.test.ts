import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCfbModelProjection,
  buildResultsEloRatings,
  buildResultsSrsRatings,
  marketHomeSpread,
  modelEdgeStars,
  modelHomeSpread,
  pointRatingFromAdjustedEpa,
  pointRatingFromCore,
  pointRatingFromElo
} from "../lib/cfbModel.ts";

const game = {
  id: "g1",
  commence_time: "2026-10-03T18:00:00Z",
  home_team: "Georgia Bulldogs",
  away_team: "Alabama Crimson Tide",
  current_spread_team: "Georgia Bulldogs",
  current_spread: -6.5
};

test("rating differences convert to a home spread with home-field value", () => {
  assert.equal(modelHomeSpread(20, 15), -7.5);
  assert.equal(marketHomeSpread(game), -6.5);
});

test("non-point rating systems convert to point-strength units", () => {
  assert.equal(pointRatingFromElo(1525), 1);
  assert.equal(pointRatingFromCore(10), 6.8);
  assert.equal(pointRatingFromAdjustedEpa(0.1), 6.5);
});

test("consensus combines rating models and direct FEI/Massey projections", () => {
  const projection = buildCfbModelProjection(game, [
    { id: "sp", label: "SP+", homeRating: 20, awayRating: 15 },
    { id: "fpi", label: "FPI", homeRating: 21, awayRating: 15 }
  ], [
    { id: "fei", label: "FEI", homeSpread: -10 },
    { id: "massey", label: "Massey", homeSpread: -8 }
  ], "2026-09-29T00:00:00Z");
  assert.equal(projection.models.length, 4);
  assert.equal(projection.consensus?.team, "Georgia");
  assert.equal(projection.consensus?.spread, -8.3);
  assert.equal(projection.edgePoints, 1.8);
  assert.equal(projection.stars, 0);
});

test("results SRS and Elo rate a repeat winner above a repeat loser", () => {
  const results = [
    { commence_time: "2026-09-05T18:00:00Z", home_team: "Georgia", away_team: "Alabama", final_home_score: 35, final_away_score: 14 },
    { commence_time: "2026-09-12T18:00:00Z", home_team: "Alabama", away_team: "Georgia", final_home_score: 17, final_away_score: 31 }
  ];
  const cutoff = "2026-09-20T18:00:00Z";
  const srs = buildResultsSrsRatings(results, cutoff);
  const elo = buildResultsEloRatings(results, cutoff);
  assert.ok((srs.get("georgia") || 0) > (srs.get("alabama") || 0));
  assert.ok((elo.get("georgia") || 0) > (elo.get("alabama") || 0));
});

test("edge stars use 3, 5 and 7 point cutoffs", () => {
  assert.equal(modelEdgeStars(2.9), 0);
  assert.equal(modelEdgeStars(3), 1);
  assert.equal(modelEdgeStars(5), 2);
  assert.equal(modelEdgeStars(7), 3);
});

test("missing market line never creates an edge star", () => {
  const projection = buildCfbModelProjection({ ...game, current_spread_team: null, current_spread: null }, [
    { id: "sp", label: "SP+", homeRating: 25, awayRating: 10 },
    { id: "fpi", label: "FPI", homeRating: 24, awayRating: 10 }
  ]);
  assert.equal(projection.market.spread, null);
  assert.equal(projection.edgePoints, null);
  assert.equal(projection.stars, 0);
});
