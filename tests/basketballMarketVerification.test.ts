import assert from "node:assert/strict";
import test from "node:test";
import { verifyBasketballPregameMarket } from "../lib/basketballMarketVerification.ts";

const game = { id: "espn-cbb-401918057", league: "CBB", home_team: "California Golden Bears", away_team: "Alabama State Hornets", current_spread_team: "California Golden Bears", current_spread: -19.5 } as any;
const spread = (awayPoint: number) => ({ awayPoint, homePoint: -awayPoint, awayOdds: -110, homeOdds: -110, suspended: false });
const quote = (awayPoint: number, phase: "pregame" | "live" = "pregame") => ({ gameId: game.id, phase, status: phase === "live" ? "inprogress" : "scheduled", spread: spread(awayPoint), moneyline: null, total: null }) as any;

test("replaces the inverted Cal/Alabama State market with ESPN's verified DK quote", () => {
  const actual = verifyBasketballPregameMarket(game, quote(-1.5), quote(19.5));
  assert.equal(actual?.spread?.awayPoint, 19.5);
  assert.equal(actual?.spread?.homePoint, -19.5);
});

test("blocks a large unverified change from a known valid stored spread", () => {
  assert.equal(verifyBasketballPregameMarket(game, quote(-1.5), null)?.spread, null);
});

test("blocks an uncorroborated absurdly large college-basketball line", () => {
  const other = { ...game, id: "espn-cbb-401921703", current_spread_team: null, current_spread: null };
  assert.equal(verifyBasketballPregameMarket(other, quote(38.5), null)?.spread, null);
});

test("preserves a genuinely large spread when independently corroborated", () => {
  const other = { ...game, current_spread: null, current_spread_team: null };
  assert.equal(verifyBasketballPregameMarket(other, quote(42.5), quote(42.5))?.spread?.awayPoint, 42.5);
});

test("keeps ordinary small price movement and non-anomalous quotes", () => {
  const other = { ...game, current_spread: null, current_spread_team: null };
  assert.equal(verifyBasketballPregameMarket(other, quote(4.5), quote(5.5))?.spread?.awayPoint, 4.5);
  assert.equal(verifyBasketballPregameMarket(other, quote(7.5), null)?.spread?.awayPoint, 7.5);
});

test("does not apply pregame checks to live-market lines", () => {
  assert.equal(verifyBasketballPregameMarket(game, quote(-1.5, "live"), quote(19.5))?.spread?.awayPoint, -1.5);
});

test("rejects nominal pick'em when both sources imply an overwhelming favorite", () => {
  const other = { ...game, current_spread: null, current_spread_team: null };
  const bad = { ...quote(-1.5), moneyline: { awayOdds: 1200, homeOdds: -2500, suspended: false } };
  assert.equal(verifyBasketballPregameMarket(other, bad, null)?.spread, null);
});

test("uses ESPN as fallback when Action Network has no basketball quote", () => {
  assert.equal(verifyBasketballPregameMarket(game, null, quote(19.5))?.spread?.awayPoint, 19.5);
});
