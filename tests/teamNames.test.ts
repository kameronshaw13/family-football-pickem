import test from "node:test";
import assert from "node:assert/strict";
import { teamAbbreviatedName, teamDisplayName } from "../lib/teamNames.ts";

test("college display names omit mascots while preserving the school name", () => {
  assert.equal(teamDisplayName("CFB", "North Dakota State Bison"), "North Dakota State");
  assert.equal(teamDisplayName("CFB", "Eastern Michigan Eagles"), "Eastern Michigan");
  assert.equal(teamDisplayName("CFB", "Mercyhurst Lakers"), "Mercyhurst");
  assert.equal(teamDisplayName("CFB", "Syracuse Orange"), "Syracuse");
  assert.equal(teamDisplayName("CFB", "UT Rio Grande Valley Vaqueros"), "UT Rio Grande Valley");
  assert.equal(teamDisplayName("CFB", "Lafayette Leopards"), "Lafayette");
});

test("college State labels display in full without changing school matching", () => {
  assert.equal(teamDisplayName("CFB", "Ohio State Buckeyes"), "Ohio State");
  assert.equal(teamDisplayName("CFB", "NC State Wolfpack"), "NC State");
  assert.equal(teamDisplayName("CFB", "San Jose State Spartans"), "San Jose State");
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

test("college abbreviations use consistent standard names", () => {
  assert.equal(teamAbbreviatedName("CFB", "New Mexico Lobos"), "UNM");
  assert.equal(teamAbbreviatedName("CFB", "Northwestern Wildcats"), "NU");
  assert.equal(teamAbbreviatedName("CFB", "Texas A&M Aggies"), "TAMU");
});


test("basketball uses school names and NBA nicknames without changing unknown identities", () => {
  assert.equal(teamDisplayName("CBB", "Wichita State Shockers"), "Wichita State");
  assert.equal(teamDisplayName("CBB", "Miami (OH) RedHawks"), "Miami (OH)");
  assert.equal(teamDisplayName("CBB", "Saint Mary's Gaels"), "Saint Mary's");
  assert.equal(teamDisplayName("NBA", "Oklahoma City Thunder"), "Thunder");
  assert.equal(teamDisplayName("NBA", "Portland Trail Blazers"), "Trail Blazers");
  assert.equal(teamAbbreviatedName("CBB", "Wichita State Shockers"), "WICH");
  assert.equal(teamAbbreviatedName("NBA", "Oklahoma City Thunder"), "OKC");
  assert.equal(teamDisplayName("CBB", "Unknown School"), "Unknown School");
});

test("Queens provider and saved-school aliases use the same school-only label", () => {
  for (const name of ["Queens University Royals", "Queens Royals", "Queens University", "Queens (NC) Royals", "Queens"]) {
    assert.equal(teamDisplayName("CBB", name), "Queens");
    assert.equal(teamAbbreviatedName("CBB", name), "QUC");
  }
  assert.equal(teamDisplayName("CBB", "New School Royals"), "New School");
  assert.equal(teamAbbreviatedName("CBB", "Wichita State"), "WICH");
});
