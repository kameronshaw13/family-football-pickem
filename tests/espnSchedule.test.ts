import test from "node:test";
import assert from "node:assert/strict";
import { findEspnScheduleMatch, type EspnScheduleGame } from "../lib/espnSchedule.ts";

function game(overrides: Partial<EspnScheduleGame> = {}): EspnScheduleGame {
  return {
    id: "401999999",
    commenceTime: "2026-09-26T22:00:00Z",
    timeValid: true,
    completed: false,
    homeScore: 7,
    awayScore: 3,
    statusDetail: "2nd",
    statusState: "in",
    possessionSide: null,
    situationText: null,
    redZone: false,
    down: null,
    distance: null,
    yardsToGoal: null,
    homeTimeouts: null,
    awayTimeouts: null,
    homeTeam: {
      displayName: "Completely Different Home Label",
      location: "Different Home",
      nickname: "Alpha",
      abbreviation: "ALP",
      logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/295.png"
    },
    awayTeam: {
      displayName: "Completely Different Away Label",
      location: "Different Away",
      nickname: "Beta",
      abbreviation: "BET",
      logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/256.png"
    },
    ...overrides
  };
}

test("ESPN schedule matching can use stable team logo ids when provider names differ", () => {
  const schedule = [game()];
  const match = findEspnScheduleMatch({
    commence_time: "2026-09-26T22:00:00Z",
    home_team: "Old Dominion Monarchs",
    away_team: "James Madison Dukes",
    home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/295.png",
    away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/256.png"
  }, schedule, { allowOneSided: false });

  assert.equal(match?.game.id, "401999999");
  assert.equal(match?.swapped, false);
});

test("logo identity still detects swapped home and away alignment", () => {
  const schedule = [game({
    homeTeam: game().awayTeam,
    awayTeam: game().homeTeam
  })];
  const match = findEspnScheduleMatch({
    commence_time: "2026-09-26T22:00:00Z",
    home_team: "Old Dominion Monarchs",
    away_team: "James Madison Dukes",
    home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/295.png",
    away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/256.png"
  }, schedule, { allowOneSided: false });

  assert.equal(match?.game.id, "401999999");
  assert.equal(match?.swapped, true);
});
