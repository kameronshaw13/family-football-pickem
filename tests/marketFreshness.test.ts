import test from "node:test";
import assert from "node:assert/strict";
import { isFreshMarketTimestamp } from "../lib/marketFreshness.ts";

test("live market rows expire at 45 seconds", () => {
  const now = Date.parse("2026-10-20T15:00:00.000Z");
  assert.equal(isFreshMarketTimestamp("2026-10-20T14:59:15.000Z", 45, now), true);
  assert.equal(isFreshMarketTimestamp("2026-10-20T14:59:14.000Z", 45, now), false);
  assert.equal(isFreshMarketTimestamp("2026-10-20T14:58:00.000Z", 45, now), false);
});
test("provider timestamps may have small skew but cannot be far in the future", () => {
  const now = Date.parse("2026-10-20T15:00:00.000Z");
  assert.equal(isFreshMarketTimestamp("2026-10-20T15:00:04.000Z", 45, now), true);
  assert.equal(isFreshMarketTimestamp("2026-10-20T15:00:06.000Z", 45, now), false);
  assert.equal(isFreshMarketTimestamp("2026-10-21T15:00:00.000Z", 45, now), false);
  assert.equal(isFreshMarketTimestamp("invalid", 45, now), false);
  assert.equal(isFreshMarketTimestamp(undefined, 45, now), false);
});
