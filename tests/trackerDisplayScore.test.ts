import test from "node:test";
import assert from "node:assert/strict";
import { trackerDisplayScore } from "../lib/trackerDisplayScore.ts";
test("live score matches the Pick Board when the summary lags", () => {
  assert.equal(trackerDisplayScore(false, true, null, 21, 14, 14), 21);
  assert.equal(trackerDisplayScore(false, true, null, 0, 7, 7), 0);
  assert.equal(trackerDisplayScore(false, true, null, null, 14, 14), 14);
});
test("confirmed final score has priority", () => {
  assert.equal(trackerDisplayScore(true, false, 28, 21, 24, 21), 28);
  assert.equal(trackerDisplayScore(true, false, null, null, 24, null), 24);
});
