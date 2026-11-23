import test from "node:test";
import assert from "node:assert/strict";
import { normalizeNotificationCounts, notificationFetchRequest, notificationReadRequest, locallyReadNotifications } from "../lib/notificationClient.ts";

test("notification count normalization retains existing fields and defaults", () => {
  assert.deepEqual(normalizeNotificationCounts({ side_bets_received: 2, league_cards: 3, total: 5 }), {
    side_bets_received: 2, side_bets_sent: 0, my_card: 0, league_cards: 3,
    side_bet_ledger: 0, total: 5
  });
  assert.deepEqual(normalizeNotificationCounts({}), {
    side_bets_received: 0, side_bets_sent: 0, my_card: 0, league_cards: 0,
    side_bet_ledger: 0, total: 0
  });
});

test("notification reads retain no-store auth and current group", () => {
  const { url, init } = notificationFetchRequest("session", "friends");
  assert.equal(url, "/api/notifications");
  assert.equal(init.cache, "no-store");
  assert.deepEqual(init.headers, {
    Authorization: "Bearer session", "x-pickem-group": "friends"
  });
});

test("mark-as-read request scopes destination and group with JSON POST", () => {
  const { url, init } = notificationReadRequest("side_bets_received", "session", "shaw-family");
  assert.equal(url, "/api/notifications");
  assert.equal(init.method, "POST");
  assert.deepEqual(init.headers, {
    "Content-Type": "application/json", Authorization: "Bearer session", "x-pickem-group": "shaw-family"
  });
  assert.deepEqual(JSON.parse(init.body), { action: "read", destination: "side_bets_received" });
});

test("optimistic read removes only chosen section count and never produces negative total", () => {
  const old = normalizeNotificationCounts({
    side_bets_received: 2, side_bets_sent: 1, my_card: 4, league_cards: 5,
    side_bet_ledger: 0, total: 12
  });
  const next = locallyReadNotifications(old, "side_bets_received");
  assert.equal(next.side_bets_received, 0);
  assert.equal(next.total, 10);
  assert.equal(next.league_cards, 5);
  assert.equal(old.side_bets_received, 2);
  assert.equal(locallyReadNotifications({ ...old, total: 1 }, "my_card").total, 0);
});
