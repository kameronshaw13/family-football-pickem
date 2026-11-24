import assert from "node:assert/strict";
import test from "node:test";
import { espnDraftKingsBasketballQuote } from "../lib/espnBasketballMarkets.ts";
import type { Game } from "../lib/types.ts";

const game: Game = {
  id: "espn-cbb-401928859", espn_event_id: "401928859", week: 4, league: "CBB",
  commence_time: "2026-11-24T18:30:00Z", lock_time: "2026-11-24T18:30:00Z", neutral_site: true,
  home_team: "UIC Flames", away_team: "Rice Owls", home_logo_url: null, away_logo_url: null,
  current_spread: null, current_spread_team: null, current_bookmaker: null, is_locked: false,
  final_home_score: null, final_away_score: null
};
const now = new Date("2026-11-24T17:17:00Z");
const team = (id: string, displayName: string) => ({ id, displayName, location: "", nickname: "", abbreviation: "", logoUrl: null });
const uic = team("82", game.home_team);
const rice = team("242", game.away_team);
const row = {
  provider: { name: "DraftKings" },
  awayTeamOdds: { team: { id: uic.id } },
  homeTeamOdds: { team: { id: rice.id } },
  pointSpread: { away: { close: { line: "-7.5", odds: "-108" } }, home: { close: { line: "+7.5", odds: "-112" } } },
  moneyline: { away: { close: { odds: "-310" } }, home: { close: { odds: "+250" } } },
  overUnder: 143.5
};
const event = { id: "401928859", statusState: "pre", homeTeam: rice, awayTeam: uic, draftKingsOdds: row };

test("assigns neutral-site Rice and UIC points and prices by team identity", () => {
  const quote = espnDraftKingsBasketballQuote(game, event, now);
  assert.deepEqual(quote?.spread, { awayPoint: 7.5, homePoint: -7.5, awayOdds: -112, homeOdds: -108, suspended: false });
  assert.deepEqual(quote?.moneyline, { awayOdds: 250, homeOdds: -310, suspended: false });
  assert.equal(quote?.total?.points, 143.5);
});

test("uses market team IDs if their side labels disagree with the event's", () => {
  const changedOrder = { ...event, homeTeam: uic, awayTeam: rice };
  assert.deepEqual(espnDraftKingsBasketballQuote(game, changedOrder, now), espnDraftKingsBasketballQuote(game, event, now));
});

test("uses event order when team IDs are omitted from the market", () => {
  const { homeTeamOdds: _home, awayTeamOdds: _away, ...noTeamIds } = row;
  assert.deepEqual(espnDraftKingsBasketballQuote(game, { ...event, draftKingsOdds: noTeamIds }, now), espnDraftKingsBasketballQuote(game, event, now));
});

test("rejects an event or quote with mismatched team identity", () => {
  assert.equal(espnDraftKingsBasketballQuote(game, { ...event, id: "other" }, now), null);
  assert.equal(espnDraftKingsBasketballQuote(game, { ...event, homeTeam: team("200", "Other school") }, now), null);
  const wrongMarket = { ...row, awayTeamOdds: { team: { id: "200" } } };
  assert.equal(espnDraftKingsBasketballQuote(game, { ...event, draftKingsOdds: wrongMarket }, now), null);
});
