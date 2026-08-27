import test from "node:test";
import assert from "node:assert/strict";
import { teamAbbreviatedName, teamDisplayName } from "../lib/teamNames.ts";

test("college display names omit mascots while preserving the school name", () => {
  assert.equal(teamDisplayName("CFB", "North Dakota State Bison"), "North Dakota St.");
  assert.equal(teamDisplayName("CFB", "Eastern Michigan Eagles"), "Eastern Michigan");
  assert.equal(teamDisplayName("CFB", "Mercyhurst Lakers"), "Mercyhurst");
  assert.equal(teamDisplayName("CFB", "Syracuse Orange"), "Syracuse");
  assert.equal(teamDisplayName("CFB", "UT Rio Grande Valley Vaqueros"), "UT Rio Grande Valley");
  assert.equal(teamDisplayName("CFB", "Lafayette Leopards"), "Lafayette");
});

test("college State labels display as St. without changing school matching", () => {
  assert.equal(teamDisplayName("CFB", "Ohio State Buckeyes"), "Ohio St.");
  assert.equal(teamDisplayName("CFB", "NC State Wolfpack"), "NC St.");
  assert.equal(teamDisplayName("CFB", "San Jose State Spartans"), "San Jose St.");
});

test("NFL display names use the team nickname", () => {
  assert.equal(teamDisplayName("NFL", "Los Angeles Chargers"), "Chargers");
  assert.equal(teamDisplayName("NFL", "Washington Commanders"), "Commanders");
});

test("compact labels use familiar abbreviations for long school names", () => {
  assert.equal(teamAbbreviatedName("CFB", "North Dakota State Bison"), "NDSU");
  assert.equal(teamAbbreviatedName("CFB", "Eastern Michigan Eagles"), "EMU");
  assert.equal(teamAbbreviatedName("CFB", "Sacramento State Hornets"), "Sac St.");
  assert.equal(teamAbbreviatedName("CFB", "Texas Longhorns"), "Texas");
  assert.equal(teamAbbreviatedName("CFB", "Florida Gators"), "Florida");
  assert.equal(teamAbbreviatedName("CFB", "Western Michigan Broncos"), "WMU");
  assert.equal(teamAbbreviatedName("CFB", "Central Michigan Chippewas"), "CMU");
});
