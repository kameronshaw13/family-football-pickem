import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { teamDisplayName } from "../lib/teamNamesBase.ts";

// Protect school-only display names introduced by the FCS odds feed.
test("new FCS school labels omit mascots", () => {
  assert.equal(teamDisplayName("CFB", "LIU Sharks"), "LIU");
  assert.equal(teamDisplayName("CFB", "Maine Black Bears"), "Maine");
  assert.equal(teamDisplayName("CFB", "Charlotte 49ers"), "Charlotte");
});

// The FCS feed must never accept the one-team fallback that allowed Northern Iowa to match Iowa.
test("FCS odds wiring disables one-sided ESPN matching", () => {
  const matcher = fs.readFileSync("lib/espnSchedule.ts", "utf8");
  const route = fs.readFileSync("app/api/cron/odds/route.ts", "utf8");
  assert.match(matcher, /options: \{ allowOneSided\?: boolean \} = \{\}/);
  assert.match(matcher, /const allowOneSided = options\.allowOneSided !== false/);
  assert.match(matcher, /if \(allowOneSided &&/);
  assert.match(route, /allowOneSided: sport\.key !== "americanfootball_ncaaf_fcs"/);
});
