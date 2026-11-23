import test from "node:test";
import assert from "node:assert/strict";
import type { Game } from "../lib/types.ts";
import { selectInitialAppCache, fetchAppDataWithRetry, retainReloadedBasketballLines } from "../lib/appLoadClient.ts";

test("initial load prefers exact cached week, with matching warmed default fallback", () => {
  const requested: Array<number | null> = [];
  const read = (week: number | null) => {
    requested.push(week);
    return week == null ? { week: 7, source: "warm" } : null;
  };
  assert.deepEqual(selectInitialAppCache(true, 7, read), { week: 7, source: "warm" });
  assert.deepEqual(requested, [7, null]);
  assert.equal(selectInitialAppCache(false, 7, read), null);
  assert.deepEqual(requested, [7, null]);
  assert.equal(selectInitialAppCache(true, 8, read), null);
  assert.deepEqual(requested, [7, null, 8, null]);
  assert.deepEqual(selectInitialAppCache(true, 7, week => week === 7 ? { week: 7, source: "exact" } : null), { week: 7, source: "exact" });
});

test("network transport retries thrown failures twice using 250ms/500ms intervals", async () => {
  const waits: number[] = [];
  let attempts = 0;
  const response = new Response(JSON.stringify({ week: 6 }), { status: 200 });
  const result = await fetchAppDataWithRetry("/api/app-data", { cache: "no-store" }, async () => {
    attempts += 1;
    if (attempts < 3) throw new Error("network");
    return response;
  }, async ms => { waits.push(ms); });
  assert.strictEqual(result, response);
  assert.equal(attempts, 3);
  assert.deepEqual(waits, [250, 500]);
});

test("HTTP 401 and 500 return to caller immediately without retries", async () => {
  for (const status of [401, 500]) {
    let attempts = 0;
    const response = await fetchAppDataWithRetry("/api/app-data", {}, async () => {
      attempts += 1;
      return new Response("error", { status });
    }, async () => { throw new Error("no wait expected"); });
    assert.equal(response.status, status);
    assert.equal(attempts, 1);
  }
});

test("after three transport failures the final error propagates", async () => {
  const attempts: number[] = [];
  await assert.rejects(
    () => fetchAppDataWithRetry("/api/app-data", {}, async () => {
      attempts.push(1);
      throw new Error("offline");
    }, async () => {}),
    /offline/
  );
  assert.equal(attempts.length, 3);
});

test("different-week payloads never inherit previous week's games or lines", () => {
  const previousGame = { id: "basket", league: "CBB", current_spread: -4, current_spread_team: "Home" } as Game;
  const currentGame = { id: "basket", league: "CBB", current_spread: null, current_spread_team: null } as Game;
  const previous = { week: 3, games: [previousGame] };
  const incoming = { week: 4, games: [currentGame] };
  assert.strictEqual(retainReloadedBasketballLines(incoming, previous), incoming);
  assert.equal(incoming.games[0].current_spread, null);
});

test("same-week reload keeps incoming identity for ineligible spread retention", () => {
  const previous = { week: 4, games: [{ id: "nfl", league: "NFL", current_spread: -3, current_spread_team: "Home" } as Game] };
  const incoming = { week: 4, games: [{ id: "nfl", league: "NFL", current_spread: null, current_spread_team: null } as Game] };
  const merged = retainReloadedBasketballLines(incoming, previous);
  assert.notStrictEqual(merged, incoming);
  assert.strictEqual(merged.games[0], incoming.games[0]);
  assert.equal(incoming.games[0].current_spread, null);
});
