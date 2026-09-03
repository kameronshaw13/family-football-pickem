import test from "node:test";
import assert from "node:assert/strict";
import { teamDisplayName } from "../lib/teamNamesBase.ts";
import { findEspnScheduleMatch } from "../lib/espnSchedule.testable.ts";

function scheduleGame(overrides: any = {}) {
  return {
    id: "game", commenceTime: "2026-09-05T20:15:00.000Z", timeValid: true, completed: false,
    homeScore: null, awayScore: null, statusDetail: null, statusState: "pre", possessionSide: null,
    situationText: null, redZone: false, down: null, distance: null, yardsToGoal: null, homeTimeouts: null, awayTimeouts: null,
    homeTeam: { displayName: "Iowa Hawkeyes", location: "Iowa", nickname: "Hawkeyes", abbreviation: "IOWA", logoUrl: null },
    awayTeam: { displayName: "Eastern Washington Eagles", location: "Eastern Washington", nickname: "Eagles", abbreviation: "EWU", logoUrl: null },
    ...overrides
  };
}

test("new FCS school labels omit mascots", () => {
  assert.equal(teamDisplayName("CFB", "LIU Sharks"), "LIU");
  assert.equal(teamDisplayName("CFB", "Maine Black Bears"), "Maine");
  assert.equal(teamDisplayName("CFB", "Charlotte 49ers"), "Charlotte");
});

test("strict FCS matching rejects a one-sided Northern Iowa to Iowa collision", () => {
  const match = findEspnScheduleMatch({ commence_time: "2026-09-05T20:15:00.000Z", home_team: "Northern Iowa Panthers", away_team: "Eastern Washington Eagles" }, [scheduleGame()] as any, { allowOneSided: false });
  assert.equal(match, null);
});

test("strict FCS matching still accepts provider LIU Post against ESPN LIU", () => {
  const match = findEspnScheduleMatch({ commence_time: "2026-09-05T00:00:00.000Z", home_team: "Kansas Jayhawks", away_team: "LIU Post Pioneers" }, [scheduleGame({
    commenceTime: "2026-09-05T00:00:00.000Z",
    homeTeam: { displayName: "Kansas Jayhawks", location: "Kansas", nickname: "Jayhawks", abbreviation: "KU", logoUrl: null },
    awayTeam: { displayName: "LIU Sharks", location: "LIU", nickname: "Sharks", abbreviation: "LIU", logoUrl: null }
  })] as any, { allowOneSided: false });
  assert.ok(match);
});
