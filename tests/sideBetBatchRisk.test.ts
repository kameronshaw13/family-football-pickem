import test from "node:test";
import assert from "node:assert/strict";
import { batchSideBetTotalRisk, batchSideBetRiskCovered } from "../lib/sideBetBatchRisk.ts";
test("batch risk includes all games, without double-counting multi-recipient offers",()=>{
  assert.equal(batchSideBetTotalRisk([20,20,10]),50);
  assert.equal(batchSideBetRiskCovered(60,[20,20,10]),true);
  assert.equal(batchSideBetRiskCovered(40,[20,20,10]),false);
});
test("invalid stake entries cannot be submitted",()=>{
  assert.equal(batchSideBetTotalRisk([20,NaN]),null);
  assert.equal(batchSideBetRiskCovered(100,[0,10]),false);
});
