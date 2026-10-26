import test from "node:test";
import assert from "node:assert/strict";
import { sheetScrollBeyondBoundary } from "../hooks/useGameSheetDismiss.ts";

test("profile scrolling stays inside both boundaries", () => {
  assert.equal(sheetScrollBeyondBoundary(0, 500, 900, 30), true);
  assert.equal(sheetScrollBeyondBoundary(400, 500, 900, -30), true);
  assert.equal(sheetScrollBeyondBoundary(-2, 500, 900, 30), true);
});

test("normal scrolling back into profile content stays available", () => {
  assert.equal(sheetScrollBeyondBoundary(0, 500, 900, -30), false);
  assert.equal(sheetScrollBeyondBoundary(400, 500, 900, 30), false);
  assert.equal(sheetScrollBeyondBoundary(150, 500, 900, 30), false);
});

test("a short profile cannot create elastic space above or below its content", () => {
  assert.equal(sheetScrollBeyondBoundary(0, 500, 500, -30), true);
  assert.equal(sheetScrollBeyondBoundary(0, 500, 500, 30), true);
});
