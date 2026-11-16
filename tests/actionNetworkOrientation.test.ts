import test from "node:test";
import assert from "node:assert/strict";
import nodeModule from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { resolve: (specifier: string, context: { parentURL?: string }, nextResolve: (specifier: string, context: { parentURL?: string }) => any) => any }) => void };
registerHooks({ resolve(specifier, context, nextResolve) {
  let url: URL | undefined;
  if (specifier.startsWith("@/")) url = new URL(`../${specifier.slice(2)}`, import.meta.url);
  else if (specifier.startsWith("./") || specifier.startsWith("../")) url = new URL(specifier, context.parentURL);
  if (url && !existsSync(fileURLToPath(url)) && existsSync(`${fileURLToPath(url)}.ts`)) return nextResolve(pathToFileURL(`${fileURLToPath(url)}.ts`).href, context);
  return nextResolve(specifier, context);
} });
const { quoteForGame } = await import("../lib/actionNetworkMarkets.ts");

test("neutral-site provider orientation preserves the saved teams' spreads and moneylines", () => {
  const game = { id: "espn-cbb-401909525", league: "CBB", commence_time: "2026-11-15T19:30:00Z", home_team: "Marquette Golden Eagles", away_team: "Missouri Tigers" } as any;
  const provider = { id: 1, status: "scheduled", start_time: game.commence_time, home_team_id: 142, away_team_id: 269,
    teams: [{ id: 142, full_name: "Missouri Tigers" }, { id: 269, full_name: "Marquette Golden Eagles" }],
    markets: { "1533": { event: {
      spread: [{ side: "home", value: 1.5, odds: -110 }, { side: "away", value: -1.5, odds: -110 }],
      moneyline: [{ side: "home", odds: 110 }, { side: "away", odds: -130 }]
    } } }
  };
  const quote = quoteForGame(game, [provider]);
  assert.equal(quote?.spread?.awayPoint, 1.5);
  assert.equal(quote?.spread?.homePoint, -1.5);
  assert.equal(quote?.moneyline?.awayOdds, 110);
  assert.equal(quote?.moneyline?.homeOdds, -130);
});
