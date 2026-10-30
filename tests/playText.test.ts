import test from "node:test";
import assert from "node:assert/strict";
import { playTextWithoutDuplicateClock } from "../lib/playText.ts";

test("hide only duplicate play clock at beginning of description", () => {
  assert.equal(playTextWithoutDuplicateClock("12:35 Smith rushes for 6 yards", "12:35"), "Smith rushes for 6 yards");
  assert.equal(playTextWithoutDuplicateClock("12:35 - Smith rushes for 6 yards", "12:35"), "Smith rushes for 6 yards");
  assert.equal(playTextWithoutDuplicateClock("12:35, Smith rushes for 6 yards", "12:35"), "Smith rushes for 6 yards");
});
test("leave independent game text and embedded clock untouched", () => {
  assert.equal(playTextWithoutDuplicateClock("Smith rushes, clock at 12:35", "12:35"), "Smith rushes, clock at 12:35");
  assert.equal(playTextWithoutDuplicateClock("12:350 is not a clock prefix", "12:35"), "12:350 is not a clock prefix");
  assert.equal(playTextWithoutDuplicateClock("1:00 pass complete", ""), "1:00 pass complete");
});
