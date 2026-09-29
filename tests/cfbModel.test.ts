import test from "node:test";
import assert from "node:assert/strict";
import { buildCfbModelProjection, marketHomeSpread, modelEdgeStars, modelHomeSpread } from "../lib/cfbModel.ts";

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

test("model consensus averages compatible rating-derived spreads", () => {
  const projection = buildCfbModelProjection(game, [
    { id: "sp", label: "SP+", homeRating: 20, awayRating: 15 },
    { id: "fpi", label: "FPI", homeRating: 21, awayRating: 15 },
    { id: "srs", label: "SRS", homeRating: 19, awayRating: 15 }
  ], "2026-09-29T00:00:00Z");
  assert.equal(projection.consensus?.team, "Georgia");
  assert.equal(projection.consensus?.spread, -7.5);
  assert.equal(projection.edgePoints, 1);
  assert.equal(projection.stars, 0);
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
