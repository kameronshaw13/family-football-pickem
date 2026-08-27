import test from "node:test";
import assert from "node:assert/strict";
import { canRefreshSpread, getGameLockTime, getSpreadFreezeTime } from "../lib/lockRules.ts";

const timezone = "America/Chicago";

test("Friday uses kickoff locking", () => {
  const kickoff = "2026-09-05T01:00:00.000Z";
  assert.equal(getSpreadFreezeTime(kickoff, timezone).toISOString(), "2026-09-05T00:00:00.000Z");
  assert.equal(getGameLockTime(kickoff, timezone).toISOString(), kickoff);
});

test("Saturday uses 9 AM freeze and 10 AM lock", () => {
  const kickoff = "2026-09-05T16:00:00.000Z";
  assert.equal(getSpreadFreezeTime(kickoff, timezone).toISOString(), "2026-09-05T14:00:00.000Z");
  assert.equal(getGameLockTime(kickoff, timezone).toISOString(), "2026-09-05T15:00:00.000Z");
});

test("Sunday and Monday use preceding Saturday deadline", () => {
  for (const kickoff of ["2026-09-06T17:00:00.000Z", "2026-09-08T00:15:00.000Z"]) {
    assert.equal(getSpreadFreezeTime(kickoff, timezone).toISOString(), "2026-09-05T14:00:00.000Z");
    assert.equal(getGameLockTime(kickoff, timezone).toISOString(), "2026-09-05T15:00:00.000Z");
  }
});

test("Saturday refreshes are allowed until freeze", () => {
  const kickoff = "2026-09-06T17:00:00.000Z";
  assert.equal(canRefreshSpread(kickoff, new Date("2026-09-05T12:50:00.000Z"), timezone), true);
  assert.equal(canRefreshSpread(kickoff, new Date("2026-09-05T13:50:00.000Z"), timezone), true);
  assert.equal(canRefreshSpread(kickoff, new Date("2026-09-05T14:00:00.000Z"), timezone), true);
  assert.equal(canRefreshSpread(kickoff, new Date("2026-09-05T14:00:00.001Z"), timezone), false);
});
