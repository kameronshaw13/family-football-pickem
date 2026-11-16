import test from "node:test";
import assert from "node:assert/strict";
import { espnTeamLogo, findEspnScheduleMatch, fresherBasketballMatch, scoreFromCompetitor, type EspnScheduleGame } from "../lib/espnSchedule.ts";

test("basketball live score picks the fresher verified event feed", () => {
  const summary = { game: game({ homeScore: 52, awayScore: 49 }), swapped: true };
  const board = { game: game({ homeScore: 55, awayScore: 50 }), swapped: true };
  assert.equal(fresherBasketballMatch(summary, board), board);
  assert.equal(fresherBasketballMatch({ game: game({ ...summary.game, completed: true }), swapped: true }, board)?.game.completed, true);
  assert.equal(fresherBasketballMatch(summary, { game: game({ statusName: "STATUS_POSTPONED", homeScore: null, awayScore: null }), swapped: true })?.game.statusName, "STATUS_POSTPONED");
});

test("ESPN college artwork follows the competitor team ID", () => {
  assert.equal(espnTeamLogo({ id: "269", logo: "https://a.espncdn.com/i/teamlogos/ncaa/500/142.png" }), "https://a.espncdn.com/i/teamlogos/ncaa/500/269.png");
});

test("missing ESPN scores stay unknown while numeric and display scores parse", () => {
  assert.equal(scoreFromCompetitor({ score: null }), null);
  assert.equal(scoreFromCompetitor({ score: "" }), null);
  assert.equal(scoreFromCompetitor({ score: { displayValue: "21" } }), 21);
  assert.equal(scoreFromCompetitor({ score: { value: 0 } }), 0);
  assert.equal(scoreFromCompetitor({ score: "-1" }), null);
});

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

test("an exact ESPN event uses both team names when saved logos are crossed", () => {
  const marquette = { displayName: "Marquette Golden Eagles", location: "Marquette", nickname: "Golden Eagles", abbreviation: "MARQ", logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/269.png" };
  const missouri = { displayName: "Missouri Tigers", location: "Missouri", nickname: "Tigers", abbreviation: "MIZ", logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/142.png" };
  const matchup = {
    espn_event_id: "401909525", commence_time: "2026-11-15T19:30:00Z",
    home_team: marquette.displayName, away_team: missouri.displayName,
    home_logo_url: missouri.logoUrl, away_logo_url: marquette.logoUrl
  };
  const direct = game({ id: "401909525", homeTeam: marquette, awayTeam: missouri, homeScore: 64, awayScore: 69 });
  assert.equal(findEspnScheduleMatch(matchup, [direct])?.swapped, false);
  assert.equal(findEspnScheduleMatch(matchup, [game({ ...direct, homeTeam: missouri, awayTeam: marquette })])?.swapped, true);
});
