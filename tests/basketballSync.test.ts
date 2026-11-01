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
const { refreshBasketballSlate } = await import("../lib/basketballSync.ts");

test("slate refresh saves new no-line games alongside existing games without clearing their creation timestamps or lines", async () => {
  const now = new Date("2026-11-01T18:00:00Z");
  const created = "2026-10-28T12:00:00Z";
  const old = { id: "espn-cbb-1", created_at: created, current_spread: -7, current_spread_team: "Home", is_locked: false };
  const writes: any[] = [];
  const db: any = { from() {
    const query: any = {
      select() { return query; }, in() { return query; }, gte() { return query; }, lte() { return query; },
      range() { return Promise.resolve({ data: [old], error: null }); },
      upsert(rows: any[]) {
        // PostgREST fills missing fields with NULL when a batch contains that column.
        if (rows.some(row => !row.created_at)) return Promise.resolve({ error: { message: "created_at violates not-null constraint" } });
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
    return Response.json({ events: [1, 2].map(id => ({ id: String(id), date: "2026-11-02T23:00:00Z", season: { type: 2 }, competitions: [{ date: "2026-11-02T23:00:00Z", timeValid: true, competitors: [
      { homeAway: "home", team: { id: "1", displayName: "Home" } },
      { homeAway: "away", team: { id: "2", displayName: `Away ${id}` } }
    ] }] })) });
  };
  try {
    const result = await refreshBasketballSlate(db, now);
    assert.equal(result.gamesDiscovered, 2);
    assert.equal(writes.find(row => row.id === old.id).created_at, created);
    assert.equal(writes.find(row => row.id === old.id).current_spread, -7);
    const added = writes.find(row => row.id === "espn-cbb-2");
    assert.equal(added.created_at, now.toISOString());
    assert.equal(added.current_spread, null);
    assert.equal(added.week, 1);
  } finally { globalThis.fetch = originalFetch; }
});
