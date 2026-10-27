import assert from "node:assert/strict";
import test from "node:test";
import nodeModule from "node:module";
const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { resolve: (specifier: string, context: { parentURL?: string }, nextResolve: (specifier: string, context: { parentURL?: string }) => any) => any }) => void };
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { basketballWeek, basketballWeekBounds, basketballFinalWeek, basketballPayoutMultiplier, basketballGameInSeason, basketballLockTime } from "../lib/basketballRules.ts";

registerHooks({ resolve(specifier, context, nextResolve) {
  let url: URL | undefined;
  if (specifier.startsWith("@/")) url = new URL(`../${specifier.slice(2)}`, import.meta.url);
  else if (specifier.startsWith("./") || specifier.startsWith("../")) url = new URL(specifier, context.parentURL);
  if (url && !existsSync(fileURLToPath(url)) && existsSync(`${fileURLToPath(url)}.ts`)) return nextResolve(pathToFileURL(`${fileURLToPath(url)}.ts`).href, context);
  return nextResolve(specifier, context);
} });
const { espnDraftKingsBasketballQuote } = await import("../lib/espnBasketballMarkets.ts");
const { settleWeekIfReady } = await import("../lib/autoSettlement.ts");
const { computeWeeklyStandings } = await import("../lib/weeklyBank.ts");
const { isGameAllowedByRules, getUnderdogBonusForRules } = await import("../lib/groupContext.ts");

test("basketball rolls over Monday midnight Central and keeps Sunday evening in the old week", () => {
  assert.equal(basketballWeek(new Date("2026-11-09T05:59:59Z")), 1);
  assert.equal(basketballWeek(new Date("2026-11-09T06:00:00Z")), 2);
  assert.equal(basketballWeek(new Date("2027-01-04T05:59:59Z")), 9);
  assert.equal(basketballWeek(new Date("2027-01-04T06:00:00Z")), 10);
});
test("basketball calendar handles DST and includes the championship Monday in its own week", () => {
  const winter = basketballWeekBounds(2);
  assert.equal(winter.start.toISOString(), "2026-11-09T06:00:00.000Z");
  assert.equal(winter.end.toISOString(), "2026-11-16T06:00:00.000Z");
  assert.equal(basketballFinalWeek(), 23);
  assert.equal(basketballWeek(new Date("2027-04-05T22:00:00Z")), 23);
  assert.equal(basketballGameInSeason("2027-04-12T04:59:59Z"), true);
  assert.equal(basketballGameInSeason("2027-04-12T05:00:00Z"), false);
  assert.equal(basketballGameInSeason("2026-10-18T20:00:00Z"), false);
});
test("only actual March Madness weeks double, including the April championship week", () => {
  assert.equal(basketballPayoutMultiplier(18), 1); // March 1–7
  assert.equal(basketballPayoutMultiplier(19), 1); // Conference tournament week
  for (const week of [20, 21, 22, 23]) assert.equal(basketballPayoutMultiplier(week), 2);
  assert.equal(basketballPayoutMultiplier(24), 1);
});
test("basketball locks each game an hour before tipoff, including Saturday and Sunday", () => {
  for (const tipoff of ["2026-11-02T01:00:00Z", "2026-11-07T19:00:00Z"]) assert.equal(Date.parse(tipoff) - basketballLockTime(tipoff).getTime(), 3600000);
});
const rules = { sport: "basketball", eligibleLeagues: ["CBB", "NBA"], pickRules: { default: { regularTotal: 5, underdogTotal: 1, perfectBonus: true } }, weeklyBank: { mode: "friends_weekly", first: 40, second: 20, third: 0, fourth: 0, fifth: 0, sixth: -10, seventh: -20, eighth: -30, perfectPayouts: { first: 60, second: 20, third: 0, fourth: 0, fifth: 0, sixth: -15, seventh: -25, eighth: -40 } } };

test("basketball dog tiers and record are unchanged, with no loss for a losing dog", () => {
  for (const [spread, wins] of [[6.5, 0], [7, 1], [9.5, 1], [10, 2], [19.5, 2], [20, 3]]) assert.equal(getUnderdogBonusForRules(rules, spread), wins);
  const row = computeWeeklyStandings([{ id: "a", display_name: "A" }], [{ user_id: "a", status: "locked", pick_type: "underdog", result: "loss" }, { user_id: "a", status: "locked", pick_type: "underdog", result: "win", underdog_win_value: 3 }] as any)[0];
  assert.equal(row.losses, 0);
  assert.equal(row.wins, 3);
  assert.equal(isGameAllowedByRules(rules, { league: "NFL", home_team: "A", away_team: "B" }), false);
  assert.equal(isGameAllowedByRules(rules, { league: "CBB", home_team: "A", away_team: "B" }), true);
  assert.equal(isGameAllowedByRules({}, { league: "NBA", home_team: "A", away_team: "B" }), false);
});
function fixture(perfect = false, seasonRules: any = rules) {
  const profiles = Array.from({ length: 8 }, (_, index) => ({ id: String(index), display_name: `Player ${index}` }));
  const wins = [perfect ? 5 : 4, 3, 2, 2, 2, 1, 1, 0];
  const picks = profiles.flatMap((profile, index) => Array.from({ length: 5 }, (_, slot) => ({ user_id: profile.id, pick_type: "regular", status: "locked", result: slot < wins[index] ? "win" : "loss" })));
  const writes: any[] = [];
  const tables: Record<string, any[]> = { group_seasons: [{ group_id: "basketball", season_year: 2026, rules: seasonRules }], group_members: profiles.map((profile) => ({ profile })), picks };
  const db: any = { from(table: string) {
    const query: any = { select() { return query; }, eq() { return query; }, upsert(rows: any[]) { writes.push(...rows); return Promise.resolve({ error: null }); }, then(resolve: any) { return Promise.resolve({ data: tables[table] || [], error: null }).then(resolve); } };
    return query;
  } };
  return { db, writes };
}
test("basketball cannot settle early even if every submitted pick is final", async () => {
  const { db, writes } = fixture();
  assert.equal((await settleWeekIfReady(db, 20, undefined, new Date("2027-03-20T19:00:00Z"))).settled, false);
  assert.equal(writes.length, 0);
});
test("March Madness doubles every normal and perfect payout, splits ties, and stays balanced", async () => {
  for (const perfect of [false, true]) {
    const normal = fixture(perfect), tournament = fixture(perfect);
    assert.equal((await settleWeekIfReady(normal.db, 19, undefined, new Date("2027-04-12T06:00:00Z"))).settled, true);
    assert.equal((await settleWeekIfReady(tournament.db, 20, undefined, new Date("2027-04-12T06:00:00Z"))).settled, true);
    for (const entry of tournament.writes) {
      assert.equal(entry.amount, normal.writes.find((row) => row.user_id === entry.user_id).amount * 2);
      assert.match(entry.note, /March Madness 2×/);
      assert.equal(entry.group_id, "basketball");
    }
    assert.equal(tournament.writes.reduce((sum, entry) => sum + entry.amount, 0), 0);
    assert.equal(tournament.writes[0].amount, perfect ? 120 : 80);
    assert.equal(tournament.writes[1].amount, 40);
    assert.equal(tournament.writes[5].amount, tournament.writes[6].amount);
  }
});
test("football payouts never receive the basketball tournament multiplier", async () => {
  const { db, writes } = fixture(false, { ...rules, sport: undefined });
  assert.equal((await settleWeekIfReady(db, 20, undefined, new Date("2027-03-20T19:00:00Z"))).settled, true);
  assert.equal(writes[0].amount, 40);
  assert.ok(writes.every((entry) => !entry.note.includes("March Madness")));
});

const marketGame = { id: "nba", espn_event_id: "123", league: "NBA", commence_time: "2026-10-20T19:00:00Z" } as any;
const marketNow = new Date("2026-10-19T12:00:00Z");
const dkRow = { provider: { name: "DraftKings" }, pointSpread: { away: { close: { line: "-1.5", odds: "-102" } }, home: { close: { line: "+1.5", odds: "-118" } } }, moneyline: { away: { close: { odds: "-112" } }, home: { close: { odds: "-108" } } }, overUnder: 222.5 };
test("basketball fallback preserves the explicitly identified DraftKings spread and market odds", () => {
  const quote = espnDraftKingsBasketballQuote(marketGame, dkRow, "pre", marketNow);
  assert.deepEqual(quote?.spread, { awayPoint: -1.5, homePoint: 1.5, awayOdds: -102, homeOdds: -118, suspended: false });
  assert.equal(quote?.total?.points, 222.5);
  assert.equal(quote?.moneyline?.awayOdds, -112);
});
test("basketball pregame fallback never substitutes a different bookmaker or a live game's closing line", () => {
  assert.equal(espnDraftKingsBasketballQuote(marketGame, { ...dkRow, provider: { name: "Other" } }, "pre", marketNow), null);
  assert.equal(espnDraftKingsBasketballQuote(marketGame, dkRow, "in", marketNow), null);
  assert.equal(espnDraftKingsBasketballQuote(marketGame, dkRow, "pre", new Date("2026-10-20T19:00:00Z")), null);
  const badSpread = { ...dkRow, pointSpread: { away: { close: { line: "-1.5" } }, home: { close: { line: "-1.5" } } } };
  assert.equal(espnDraftKingsBasketballQuote(marketGame, badSpread, "pre", marketNow)?.spread, null);
});
