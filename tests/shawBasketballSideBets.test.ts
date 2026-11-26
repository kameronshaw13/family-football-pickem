import assert from "node:assert/strict";
import test from "node:test";
import { isShawBasketballSideBet, shawSideBetWeekBounds, sideBetWeekForGame, sideBetWeekFilter } from "../lib/shawBasketballSideBets.ts";

test("Shaw basketball uses the football calendar without modifying stored game week", () => {
  const game = { league: "CBB", week: 4, commence_time: "2026-11-27T01:00:00Z" };
  assert.equal(sideBetWeekForGame("shaw-family", game, "America/Chicago"), 14);
  assert.equal(sideBetWeekForGame("friends-basketball", game, "America/Chicago"), 4);
  assert.equal(sideBetWeekForGame("shaw-family", { ...game, league: "CFB", week: 14 }, "America/Chicago"), 14);
  assert.equal(game.week, 4);
  assert.equal(isShawBasketballSideBet("friends", "NBA"), false);
  assert.equal(isShawBasketballSideBet("shaw-family", "NBA"), true);
});

test("Shaw uses a Tuesday–Monday slate across timezone changes", () => {
  const bounds = shawSideBetWeekBounds(2026, 14, "America/Chicago");
  assert.deepEqual(bounds, { start: "2026-11-24T06:00:00.000Z", end: "2026-12-01T06:00:00.000Z" });
  assert.equal(sideBetWeekForGame("shaw-family", { league: "NBA", week: 5, commence_time: "2026-12-01T05:59:59Z" }, "America/Chicago"), 14);
  assert.equal(sideBetWeekForGame("shaw-family", { league: "NBA", week: 5, commence_time: "2026-12-01T06:00:00Z" }, "America/Chicago"), 15);
  assert.equal(sideBetWeekFilter("friends", 2026, 14, "America/Chicago"), "week.eq.14");
  assert.match(sideBetWeekFilter("shaw-family", 2026, 14, "America/Chicago"), /league.in.\(CBB,NBA\)/);
});
