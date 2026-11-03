import test from "node:test";
import assert from "node:assert/strict";
import { hasUsableStoredGameSpread, normalizeVerifiedMarketSpread } from "../lib/marketSpread.ts";
import { gradeAgainstSpread, normalizeSpreadForSelectedTeam } from "../lib/spreads.ts";

const pricedPK = { awayPoint: 0, homePoint: 0, awayOdds: -110, homeOdds: -110, suspended: false };

for (const league of ["CBB", "NBA"] as const) {
  test(`${league}: a verified PK becomes home -0.5 and away +0.5`, () => {
    const spread = normalizeVerifiedMarketSpread(league, pricedPK);
    assert.equal(spread?.homePoint, -0.5);
    assert.equal(spread?.awayPoint, 0.5);
    assert.equal(normalizeSpreadForSelectedTeam("Home", "Away", spread!.awayPoint), -0.5);
    assert.equal(gradeAgainstSpread("Home", "Home", "Away", 80, 79, -0.5), "win");
    assert.equal(gradeAgainstSpread("Away", "Home", "Away", 80, 79, 0.5), "loss");
  });
  test(`${league}: unpriced zeroes are never usable market lines`, () => {
    assert.equal(normalizeVerifiedMarketSpread(league, { ...pricedPK, awayOdds: null, homeOdds: null }), null);
    assert.equal(normalizeVerifiedMarketSpread(league, { ...pricedPK, homeOdds: null }), null);
    assert.equal(hasUsableStoredGameSpread({ league, current_spread_team: "Away", current_spread: 0 }), false);
    assert.equal(hasUsableStoredGameSpread({ league, current_spread_team: "Away", current_spread: 0.5 }), true);
  });
}

test("football's priced PK remains zero; unpriced PK is rejected", () => {
  assert.deepEqual(normalizeVerifiedMarketSpread("CFB", pricedPK), pricedPK);
  assert.equal(normalizeVerifiedMarketSpread("NFL", { ...pricedPK, awayOdds: null }), null);
});
test("non-PK lines stay unchanged; mismatched two-sided lines are rejected", () => {
  const spread = { awayPoint: 39.5, homePoint: -39.5, awayOdds: -110, homeOdds: -110, suspended: false };
  assert.deepEqual(normalizeVerifiedMarketSpread("CBB", spread), spread);
  assert.equal(normalizeVerifiedMarketSpread("CBB", { ...spread, homePoint: 39.5 }), null);
});
