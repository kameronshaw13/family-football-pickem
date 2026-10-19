import test from "node:test";
import assert from "node:assert/strict";
import { scheduledMarketRefreshWindow } from "../lib/marketSchedule.ts";

test("market cadence follows Central time through daylight saving changes", () => {
  assert.deepEqual(scheduledMarketRefreshWindow(new Date("2026-10-20T12:50:00Z")), { shouldRefresh: true, refreshFuture: true });
  assert.deepEqual(scheduledMarketRefreshWindow(new Date("2026-10-20T13:20:00Z")), { shouldRefresh: true, refreshFuture: false });
  assert.deepEqual(scheduledMarketRefreshWindow(new Date("2026-10-20T13:50:00Z")), { shouldRefresh: true, refreshFuture: true });
  assert.deepEqual(scheduledMarketRefreshWindow(new Date("2026-10-20T13:35:00Z")), { shouldRefresh: false, refreshFuture: false });
  assert.deepEqual(scheduledMarketRefreshWindow(new Date("2027-01-12T14:20:00Z")), { shouldRefresh: true, refreshFuture: false });
  assert.deepEqual(scheduledMarketRefreshWindow(new Date("2026-10-19T13:50:00Z")), { shouldRefresh: true, refreshFuture: true });
});
