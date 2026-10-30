import test from "node:test";
import assert from "node:assert/strict";
import { batchSideBetTotalRisk, batchSpreadIsConfigured, batchWeekMatchesView } from "../lib/sideBetBatchRisk.ts";
test("batch risk includes all games, without double-counting multi-recipient offers",()=>{
  assert.equal(batchSideBetTotalRisk([20,20,10]),50);
});
test("invalid stake entries cannot be submitted",()=>{
  assert.equal(batchSideBetTotalRisk([20,NaN]),null);
  assert.equal(batchSideBetTotalRisk([0,10]),null);
});

test("batch spread is required for spread bets, including when input is blank", () => {
  assert.equal(batchSpreadIsConfigured("spread", null), false);
  assert.equal(batchSpreadIsConfigured("spread", undefined), false);
  assert.equal(batchSpreadIsConfigured("spread", NaN), false);
  assert.equal(batchSpreadIsConfigured("spread", 0), true);
  assert.equal(batchSpreadIsConfigured("spread", -7.5), true);
  assert.equal(batchSpreadIsConfigured("moneyline", null), true);
});

test("a batch cannot silently submit games from another week", () => {
  assert.equal(batchWeekMatchesView([8, 8], 8), true);
  assert.equal(batchWeekMatchesView([8, 8], null), true);
  assert.equal(batchWeekMatchesView([8, 9], 8), false);
  assert.equal(batchWeekMatchesView([8, 8], 9), false);
  assert.equal(batchWeekMatchesView([], 8), false);
});
