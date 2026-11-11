import test from "node:test";
import assert from "node:assert/strict";
import { actionV2MarketRows } from "../lib/actionNetworkV2.ts";

test("adapts a v2 event spread and moneyline for the selected book", () => {
  const game = { markets: { "15": { event: {
    spread: [{ side: "away", value: -3.5, odds: -110 }, { side: "home", value: 3.5, odds: -110 }],
    moneyline: [{ side: "away", odds: -165 }, { side: "home", odds: 145 }],
    total: [{ side: "over", value: 46.5, odds: -112 }, { side: "under", value: 46.5, odds: -108 }]
  } } } };
  assert.deepEqual(actionV2MarketRows(game, 15), [{
    book_id: 15, type: "game", spread_away: -3.5, spread_home: 3.5,
    spread_away_line: -110, spread_home_line: -110,
    ml_away: -165, ml_home: 145, total: 46.5, over: -112, under: -108, line_status: {}
  }]);
});
test("never substitutes another book or missing values", () => {
  assert.deepEqual(actionV2MarketRows({ markets: { "30": { event: { spread: [{ side: "home", value: -4 }] } } } },15), []);
  assert.deepEqual(actionV2MarketRows({ markets: { "15": { event: { spread: [{ side: "home", value: null }] } } } },15), []);
});
test("respects market suspension and only accepts full game", () => {
  const rows=actionV2MarketRows({ markets: { "15": { event: {
    spread: [{ side:"away", period:"event", value:2.5, odds:-110, status:"suspended" },
             { side:"home", period:"event", value:-2.5, odds:-110 },
             { side:"away", period:"firsthalf", value:1, odds:-110 }]
  } } } },15);
  assert.equal(rows[0].spread_away,2.5);
  assert.equal(rows[0].line_status.spread_away,2);
  assert.equal(rows[0].type,"game");
});
