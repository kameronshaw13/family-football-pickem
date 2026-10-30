import test from "node:test";
import assert from "node:assert/strict";
import { trackerPeriodLabel, trackerPeriodHeading } from "../lib/trackerPeriods.ts";

test("regular game periods use ordinal quarter headings", () => {
  assert.equal(trackerPeriodHeading("1"), "1st Quarter");
  assert.equal(trackerPeriodHeading("Q3"), "3rd Quarter");
  assert.equal(trackerPeriodHeading("4th"), "4th Quarter");
});

test("ESPN overtime formats never turn into first or second quarter", () => {
  assert.equal(trackerPeriodLabel("5"), "1OT");
  assert.equal(trackerPeriodLabel("6"), "2OT");
  assert.equal(trackerPeriodLabel("OT1"), "1OT");
  assert.equal(trackerPeriodLabel("1OT"), "1OT");
  assert.equal(trackerPeriodHeading("Overtime"), "OT");
  assert.equal(trackerPeriodHeading("OT2"), "2OT");
});
