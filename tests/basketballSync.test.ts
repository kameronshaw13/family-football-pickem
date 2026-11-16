import assert from "node:assert/strict";
import test from "node:test";
import nodeModule from "node:module";
const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { resolve: (specifier: string, context: { parentURL?: string }, nextResolve: (specifier: string, context: { parentURL?: string }) => any) => any }) => void };
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "./footballMarketSync" && context.parentURL?.endsWith("/basketballSync.ts")) {
    return { url: "data:text/javascript,export async function refreshActionNetworkSpreads() { return { gamesUpdated: 0 }; }", shortCircuit: true };
  }
  let url: URL | undefined;
  if (specifier.startsWith("@/")) url = new URL(`../${specifier.slice(2)}`, import.meta.url);
  else if (specifier.startsWith("./") || specifier.startsWith("../")) url = new URL(specifier, context.parentURL);
  if (url && !existsSync(fileURLToPath(url)) && existsSync(`${fileURLToPath(url)}.ts`)) return nextResolve(pathToFileURL(`${fileURLToPath(url)}.ts`).href, context);
  return nextResolve(specifier, context);
} });
const { refreshBasketballSlate, basketballScheduleRow, voidRescheduledGame } = await import("../lib/basketballSync.ts");

test("moving a game to another date voids pending picks and refunds accepted side bets", async () => {
  const calls: Array<{ table: string; values: any; filters: Array<[string, string]> }> = [];
  const db: any = { from(table: string) {
    const call = { table, values: null as any, filters: [] as Array<[string, string]> };
    const query: any = {
      update(values: any) { call.values = values; calls.push(call); return query; },
      delete() { call.values = { status: "draft deleted" }; calls.push(call); return query; },
      eq(column: string, value: string) { call.filters.push([column, value]); return query; },
      then(resolve: (value: any) => void) { resolve({ error: null }); }
    };
    return query;
  } };
  await voidRescheduledGame(db, "espn-cbb-123", new Date("2026-11-16T04:00:00Z"));
  assert.deepEqual(calls.map((call) => [call.table, call.values.result || call.values.status || call.values.event_status]), [
    ["picks", "draft deleted"], ["picks", "push"], ["side_bets", "push"], ["side_bets", "cancelled"], ["games", "STATUS_RESCHEDULED"]
  ]);
  assert.equal(calls[2].values.winner_id, null);
  assert.deepEqual(calls[2].filters, [["game_id", "espn-cbb-123"], ["status", "accepted"]]);
});

test("locked neutral-site games keep logos with the saved teams when ESPN reverses home and away", () => {
  const old = { id: "espn-cbb-401909525", espn_event_id: "401909525", league: "CBB", week: 2,
    commence_time: "2026-11-15T19:30:00Z", home_team: "Marquette Golden Eagles", away_team: "Missouri Tigers",
    home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/269.png",
    away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/142.png" } as any;
  const event = { id: "401909525", commenceTime: old.commence_time, statusName: "STATUS_FINAL", neutralSite: true,
    homeTeam: { id: "142", displayName: "Missouri Tigers", logoUrl: old.away_logo_url },
    awayTeam: { id: "269", displayName: "Marquette Golden Eagles", logoUrl: old.home_logo_url } } as any;
  const row = basketballScheduleRow("CBB", event, old, new Date("2026-11-16T02:00:00Z"));
  assert.equal(row.home_team, old.home_team);
  assert.equal(row.away_team, old.away_team);
  assert.equal(row.home_logo_url, old.home_logo_url);
  assert.equal(row.away_logo_url, old.away_logo_url);
});

test("a moved game follows its new week and discards the stale line", () => {
  const old = { id: "espn-cbb-401921760", espn_event_id: "401921760", league: "CBB", week: 2,
    commence_time: "2026-11-15T19:00:00Z", home_team: "Utah Utes", away_team: "Washington Huskies",
    current_spread_team: "Utah Utes", current_spread: -4.5 } as any;
  const event = { id: "401921760", commenceTime: "2026-12-06T00:00:00Z", statusName: "STATUS_SCHEDULED",
    homeTeam: { id: "254", displayName: "Utah Utes", logoUrl: null },
    awayTeam: { id: "264", displayName: "Washington Huskies", logoUrl: null } } as any;
  const row = basketballScheduleRow("CBB", event, old, new Date("2026-11-16T02:00:00Z"));
  assert.notEqual(row.week, old.week);
  assert.equal(row.current_spread, null);
  assert.equal(row.is_locked, false);
});

test("slate refresh writes schedule fields without overwriting existing creation timestamps or lines", async () => {
  const now = new Date("2026-11-01T18:00:00Z");
  const created = "2026-10-28T12:00:00Z";
  const old = { id: "espn-cbb-1", created_at: created, current_spread: -7, current_spread_team: "Home", is_locked: false };
  const writes: any[] = [];
  const db: any = { from() {
    const query: any = {
      select() { return query; }, in() { return query; }, gte() { return query; }, lte() { return query; }, order() { return query; },
      range() { return Promise.resolve({ data: [old], error: null }); },
      upsert(rows: any[]) {
        writes.push(...rows);
        return Promise.resolve({ error: null });
      }
    };
    return query;
  } };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: any) => {
    const url = String(input);
    if (url.includes("/teams?")) return Response.json({ sports: [{ leagues: [{ teams: Array.from({ length: 365 }, (_, i) => ({ team: { id: String(i + 1) } })) }] }] });
    if (url.includes("/nba/")) return Response.json({ events: [] });
    return Response.json({ events: [1, 2].map(id => ({ id: String(id), date: "2026-11-02T23:00:00Z", season: { type: 2 }, competitions: [{ date: "2026-11-02T23:00:00Z", timeValid: true, neutralSite: id === 1, competitors: [
      { homeAway: "home", team: { id: "1", displayName: "Home" } },
      { homeAway: "away", team: { id: "2", displayName: `Away ${id}` } }
    ] }] })) });
  };
  try {
    const result = await refreshBasketballSlate(db, now);
    assert.equal(result.gamesDiscovered, 2);
    assert.equal(writes.find(row => row.id === old.id).created_at, undefined);
    assert.equal(writes.find(row => row.id === old.id).current_spread, undefined);
    assert.equal(writes.find(row => row.id === old.id).neutral_site, true);
    const added = writes.find(row => row.id === "espn-cbb-2");
    assert.equal(added.created_at, undefined);
    assert.equal(added.current_spread, undefined);
    assert.equal(added.neutral_site, false);
    assert.equal(added.week, 1);
  } finally { globalThis.fetch = originalFetch; }
});

const { recoverMissingClosingSpreads } = await import("../lib/closingSpreadSync.ts");
test("closing recovery fills only empty completed games and never writes picks or overwrites saved lines", async () => {
  const writes: any[] = [];
  const db: any = { from(table: string) {
    assert.equal(table, "games");
    const query: any = {
      update(values: any) { writes.push({ values }); return query; },
      eq(key: string, value: string) { assert.equal(key, "id"); writes.at(-1).id = value; return query; },
      is(key: string, value: null) { assert.equal(key, "current_spread"); assert.equal(value, null); return query; },
      select() { return Promise.resolve({ data: [{ id: writes.at(-1).id }], error: null }); }
    }; return query;
  } };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: any) => {
    const id = new URL(String(input)).searchParams.get("event");
    assert.notEqual(id, "saved");
    return Response.json({ header: { id, competitions: [{ status: { type: { completed: id === "final" } } }] }, pickcenter: [{
      provider: { name: "DraftKings" }, pointSpread: { away: { close: { line: "-8.5", odds: "-110" } }, home: { close: { line: "+8.5", odds: "-110" } } }
    }] });
  };
  const game: any = { id: "empty", league: "CBB", away_team: "Away", current_spread: null, espn_event_id: "final" };
  try {
    assert.equal(await recoverMissingClosingSpreads(db, [game, { ...game, id: "live", espn_event_id: "live" }, { ...game, id: "saved", espn_event_id: "saved", current_spread: -1.5 }]), 1);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].id, "empty");
    assert.equal(writes[0].values.current_spread, -8.5);
    assert.equal(writes[0].values.current_bookmaker, "DraftKings (closing)");
  } finally { globalThis.fetch = originalFetch; }
});
