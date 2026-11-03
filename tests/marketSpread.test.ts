import test from "node:test";
import assert from "node:assert/strict";
import { hasUsableStoredGameSpread, normalizeVerifiedMarketSpread, verifiedClosingSpread } from "../lib/marketSpread.ts";
import { gradeAgainstSpread, normalizeSpreadForSelectedTeam } from "../lib/spreads.ts";

const pricedPK = { awayPoint: 0, homePoint: 0, awayOdds: -110, homeOdds: -110, suspended: false };

for (const league of ["CBB", "NBA", "CFB", "NFL"] as const) {
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

test("non-PK lines stay unchanged; mismatched two-sided lines are rejected", () => {
  const spread = { awayPoint: 39.5, homePoint: -39.5, awayOdds: -110, homeOdds: -110, suspended: false };
  assert.deepEqual(normalizeVerifiedMarketSpread("CBB", spread), spread);
  assert.equal(normalizeVerifiedMarketSpread("CBB", { ...spread, homePoint: 39.5 }), null);
});

const closingRow = { provider: { name: "DraftKings" }, pointSpread: { away: { close: { line: "-8.5", odds: "-110" } }, home: { close: { line: "+8.5", odds: "-110" } } } };
test("historical recovery requires a named provider and complete priced closing spread", () => {
  assert.equal(verifiedClosingSpread("CBB", closingRow)?.awayPoint, -8.5);
  assert.equal(verifiedClosingSpread("CBB", { ...closingRow, provider: { name: "Other" } }), null);
  assert.equal(verifiedClosingSpread("CBB", { provider: closingRow.provider, spread: 1.5 }), null);
  assert.equal(verifiedClosingSpread("CBB", { ...closingRow, pointSpread: { away: closingRow.pointSpread.away } }), null);
});

for (const league of ["CBB", "NBA", "CFB", "NFL"] as const) {
  test(`${league}: nominal 1.5 with near-even moneylines becomes a half point`, () => {
    const market = { awayPoint: 1.5, homePoint: -1.5, awayOdds: -105, homeOdds: -115, suspended: false };
    for (const [awayOdds, homeOdds] of [[-100,-110],[-105,-115],[-110,-110],[100,-110]]) {
      const normalized = normalizeVerifiedMarketSpread(league, market, { awayOdds, homeOdds });
      assert.equal(normalized?.homePoint, -0.5);
      assert.equal(normalized?.awayPoint, 0.5);
    }
    assert.equal(normalizeVerifiedMarketSpread(league, market, { awayOdds: -115, homeOdds: -105 })?.awayPoint, league === "NFL" ? -0.5 : 0.5);
    for (const moneyline of [null, { awayOdds: 100, homeOdds: -120 }, { awayOdds: -120, homeOdds: 100 }, { awayOdds: 105, homeOdds: -125 }, { awayOdds: -116, homeOdds: -104 }, { awayOdds: -100, homeOdds: -115 }, { awayOdds: 110, homeOdds: -130 }, { awayOdds: 0, homeOdds: -110 }, { awayOdds: -110, homeOdds: -110, suspended: true }]) {
      assert.deepEqual(normalizeVerifiedMarketSpread(league, market, moneyline), market);
    }
    const realSpread = { ...market, awayPoint: 3.5, homePoint: -3.5 };
    assert.deepEqual(normalizeVerifiedMarketSpread(league, realSpread, { awayOdds: -110, homeOdds: -110 }), realSpread);
  });
}

for (const league of ["CBB", "NBA", "CFB", "NFL"] as const) {
  test(`${league}: -120/+100 preserves the exact listed spread in either direction`, () => {
    for (const awayPoint of [-4.5, -2.5, -1.5, -1, -0.5, 0.5, 1, 1.5, 2.5, 4.5]) {
      const listed = { awayPoint, homePoint: -awayPoint, awayOdds: -110, homeOdds: -110, suspended: false };
      for (const moneyline of [{ awayOdds: -120, homeOdds: 100 }, { awayOdds: 100, homeOdds: -120 }]) {
        assert.deepEqual(normalizeVerifiedMarketSpread(league, listed, moneyline), listed);
      }
    }
  });
}

for (const league of ["CBB", "NBA", "CFB", "NFL"] as const) {
  test(`${league}: away -113/home -107 flips pickem only in NFL`, () => {
    for (const awayPoint of [-1.5, 1.5, 0]) {
      const market = { awayPoint, homePoint: -awayPoint, awayOdds: -110, homeOdds: -110, suspended: false };
      const result = normalizeVerifiedMarketSpread(league, market, { awayOdds: -113, homeOdds: -107 });
      assert.equal(result?.awayPoint, league === "NFL" ? -0.5 : 0.5);
      assert.equal(result?.homePoint, league === "NFL" ? 0.5 : -0.5);
      assert.equal(normalizeVerifiedMarketSpread(league, market, { awayOdds: -107, homeOdds: -113 })?.homePoint, -0.5);
      assert.equal(normalizeVerifiedMarketSpread(league, market, { awayOdds: -110, homeOdds: -110 })?.homePoint, -0.5);
    }
  });
}
