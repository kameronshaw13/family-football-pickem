import test from "node:test";
import assert from "node:assert/strict";
import { batchSideBetTotalRisk } from "../lib/sideBetBatchRisk.ts";
test("batch risk includes all games, without double-counting multi-recipient offers",()=>{
  assert.equal(batchSideBetTotalRisk([20,20,10]),50);
});
test("invalid stake entries cannot be submitted",()=>{
  assert.equal(batchSideBetTotalRisk([20,NaN]),null);
  assert.equal(batchSideBetTotalRisk([0,10]),null);
});
