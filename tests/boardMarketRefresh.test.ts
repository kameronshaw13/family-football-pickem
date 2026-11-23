import test from "node:test";
import assert from "node:assert/strict";
import type { Game, SideBetMarketQuote } from "../lib/types.ts";
import { hasNewBoardScheduleGames, reconcileBoardMarketGames, type BoardScheduleUpdate } from "../lib/boardMarketRefresh.ts";

const now = new Date("2026-11-23T19:00:00Z");
const game = (id: string, fields: Partial<Game> = {}) => ({
  id, week: 13, league: "CFB", away_team: "Away", home_team: "Home",
  commence_time: "2026-11-28T19:00:00Z", neutral_site: false,
  event_status: null, lock_time: "2026-11-28T18:00:00Z", is_locked: false,
  current_spread_team: "Away", current_spread: 3, current_bookmaker: "DraftKings",
  ...fields
} as Game);
const quote = (id: string, awayPoint: number, fields: Partial<SideBetMarketQuote> = {}) => ({
  gameId: id, phase: "pregame",
  spread: { awayPoint, homePoint: -awayPoint, awayOdds: -110, homeOdds: -110, suspended: false },
  moneyline: null, ...fields
} as SideBetMarketQuote);
const schedule = (g: Game): BoardScheduleUpdate => ({
  id: g.id, commence_time: g.commence_time, neutral_site: Boolean(g.neutral_site),
  event_status: g.event_status || null, lock_time: g.lock_time, is_locked: g.is_locked
});

test("new games in refreshed schedule trigger reload without mutating existing slate", () => {
  const existing = game("a");
  assert.equal(hasNewBoardScheduleGames([existing], [schedule(existing)]), false);
  assert.equal(hasNewBoardScheduleGames([existing], [schedule(existing), schedule(game("b"))]), true);
  assert.equal(existing.id, "a");
});

test("unchanged schedule and priced spread retain identity and avoid renders", () => {
  const g = game("a");
  const list = [g];
  const output = reconcileBoardMarketGames(list, [quote("a", 3)], [schedule(g)], now);
  assert.strictEqual(output, list);
  assert.strictEqual(output[0], g);
});

test("new pregame spread updates only target game and preserves other fields", () => {
  const g = game("a", { live_home_score: 10 });
  const other = game("b");
  const output = reconcileBoardMarketGames([g, other], [quote("a", 4.5)], [], now);
  assert.equal(output[0].current_spread, 4.5);
  assert.equal(output[0].current_spread_team, "Away");
  assert.equal(output[0].current_bookmaker, "DraftKings");
  assert.equal(output[0].updated_at, now.toISOString());
  assert.equal(output[0].live_home_score, 10);
  assert.strictEqual(output[1], other);
  assert.equal(g.current_spread, 3);
});

test("suspended and live quotes do not overwrite the visible pregame spread", () => {
  const g = game("a");
  assert.strictEqual(reconcileBoardMarketGames([g], [quote("a", 5, { phase: "live" })], [], now)[0], g);
  assert.strictEqual(reconcileBoardMarketGames([g], [quote("a", 5, {
    spread: { awayPoint: 5, homePoint: -5, awayOdds: -110, homeOdds: -110, suspended: true }
  })], [], now)[0], g);
});

test("locked or already-started games never receive a new market spread", () => {
  const g = game("a", { commence_time: "2026-11-23T18:00:00Z", lock_time: "2026-11-23T17:00:00Z" });
  const output = reconcileBoardMarketGames([g], [quote("a", 7)], [], now);
  assert.strictEqual(output[0], g);
  assert.equal(g.current_spread, 3);
});

test("schedule-only changes remain visible even when spread is locked", () => {
  const g = game("a", { commence_time: "2026-11-23T18:00:00Z" });
  const next = { ...schedule(g), neutral_site: true, event_status: "STATUS_DELAYED" };
  const output = reconcileBoardMarketGames([g], [quote("a", 7)], [next], now);
  assert.equal(output[0].neutral_site, true);
  assert.equal(output[0].event_status, "STATUS_DELAYED");
  assert.equal(output[0].current_spread, 3);
  assert.equal(g.event_status, null);
});

test("basketball refresh respects earlier spread lock despite later scheduled tip", () => {
  const g = game("cbb", {
    league: "CBB", commence_time: "2026-11-23T19:30:00Z",
    lock_time: "2026-11-23T18:30:00Z"
  });
  const output = reconcileBoardMarketGames([g], [quote("cbb", 8)], [], now);
  assert.equal(output[0].current_spread, 3);
});
