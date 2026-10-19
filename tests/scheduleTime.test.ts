import test from "node:test";
import assert from "node:assert/strict";
import { isVerifiedTbdKickoff } from "../lib/scheduleTime.ts";

test("a TBD event accepts a nearby confirmed kickoff but rejects an old week", () => {
  const october31Placeholder = "2026-10-31T04:00:00Z";
  assert.equal(isVerifiedTbdKickoff("2026-10-31T16:00:00Z", october31Placeholder), true);
  assert.equal(isVerifiedTbdKickoff("2026-10-17T19:30:00Z", october31Placeholder), false);
  assert.equal(isVerifiedTbdKickoff(october31Placeholder, october31Placeholder), false);
  assert.equal(isVerifiedTbdKickoff(null, october31Placeholder), false);
});
