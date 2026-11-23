import test from "node:test";
import assert from "node:assert/strict";
import { navigationNotificationCounts } from "../lib/notificationPresentation.ts";

const counts = {
  side_bets_received: 2,
  side_bets_sent: 3,
  my_card: 4,
  league_cards: 5,
  side_bet_ledger: 6,
  total: 20
};

test("navigation badges aggregate sections without changing notification records", () => {
  const actual = navigationNotificationCounts(counts, false, false);
  assert.deepEqual(actual.navNotificationCounts, { picks: 5, card: 9, standings: 6 });
  assert.deepEqual(counts, { side_bets_received: 2, side_bets_sent: 3, my_card: 4, league_cards: 5, side_bet_ledger: 6, total: 20 });
});

test("hidden Side Bets suppress corresponding badges but not league card counts", () => {
  const actual = navigationNotificationCounts(counts, true, false);
  assert.deepEqual(actual.navNotificationCounts, { picks: 0, card: 9, standings: 0 });
});

test("preview uses placeholder badges unless bet visibility suppresses them", () => {
  assert.deepEqual(navigationNotificationCounts(counts, false, true).navNotificationCounts, { picks: 2, card: 2, standings: 1 });
  assert.deepEqual(navigationNotificationCounts(counts, true, true).navNotificationCounts, { picks: 0, card: 2, standings: 0 });
});
