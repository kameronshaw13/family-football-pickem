import assert from "node:assert/strict";
import test from "node:test";
import { logoLuminance, logoNeedsDarkBacking, logoNeedsOutline, readLogoEdges, readLogoPalette, trackerTeamColors } from "../lib/trackerTeamColors.ts";

test("a white or duplicate alternate becomes a distinct, nonwhite color", () => {
  assert.equal(trackerTeamColors("0A2240", "C8102E").secondary, "#c8102e");
  assert.notEqual(trackerTeamColors("ffffff", "fffffe").secondary, "#ffffff");
  const artwork = readLogoPalette(new Uint8ClampedArray(Array(8).fill([255, 102, 15, 255]).flat()));
  assert.equal(trackerTeamColors("64267E", "ffffff", artwork).secondary, "#ff660f");
  for (const secondary of ["ffffff", "fafafa", "0A2240", null, "invalid"]) {
    const palette = trackerTeamColors("0A2240", secondary);
    assert.equal(palette.primary, "#0a2240");
    assert.notEqual(palette.secondary, palette.primary);
    assert.notEqual(palette.secondary, "#ffffff");
  }
});

test("a white outline improves a dark logo on a dark background, while pale marks get a dark backing", () => {
  const edges = [logoLuminance(10, 34, 64), logoLuminance(10, 34, 64)];
  assert.equal(logoNeedsOutline(edges, "#20282d"), true);
  assert.equal(logoNeedsOutline(edges, "#fbfaf6"), false);
  assert.equal(logoNeedsOutline([1, 1, .8], "#20282d"), false);
  assert.equal(logoNeedsDarkBacking(edges), false);
  assert.equal(logoNeedsDarkBacking([1, 1, .8, .4]), true);
  assert.equal(logoNeedsDarkBacking([1, 1, .8, .4], ["#49266c", "#f3b237"]), false);
  assert.deepEqual(readLogoEdges(new Uint8ClampedArray([10, 34, 64, 255]), 1), edges.slice(0, 1));
});
