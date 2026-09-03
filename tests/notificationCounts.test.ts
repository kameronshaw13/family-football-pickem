import assert from "node:assert/strict";
import test from "node:test";
import { countUnreadNotifications } from "../lib/notificationCounts.ts";

test("read notifications stop contributing to destination and total badges", () => {
  const counts = countUnreadNotifications([
    { destination: "side_bets_received", read_at: null },
    { destination: "side_bets_received", read_at: "2026-09-03T12:00:00.000Z", action_required: true },
    { destination: "side_bets_sent", read_at: null }
  ]);

  assert.equal(counts.side_bets_received, 1);
  assert.equal(counts.side_bets_sent, 1);
  assert.equal(counts.total, 2);
});

test("unknown destinations never affect app badges", () => {
  const counts = countUnreadNotifications([
    { destination: "unknown", read_at: null }
  ]);

  assert.equal(counts.total, 0);
});
