import test from "node:test";
import assert from "node:assert/strict";
import {
  LIVE_OFFER_SCORE_CONFIRMATION_MS,
  liveOfferScoreCandidateAction
} from "../lib/liveOfferExpiration.ts";

test("starts confirmation instead of expiring on the first higher score", () => {
  const nowMs = Date.parse("2026-10-03T00:00:00.000Z");
  assert.deepEqual(liveOfferScoreCandidateAction({
    scoreState: "changed",
    currentTotal: 21,
    candidateTotal: null,
    candidateSeenAt: null,
    nowMs
  }), {
    kind: "start",
    total: 21,
    seenAt: "2026-10-03T00:00:00.000Z"
  });
});

test("does not expire while the higher score is still inside the confirmation window", () => {
  const nowMs = Date.parse("2026-10-03T00:00:10.000Z");
  assert.deepEqual(liveOfferScoreCandidateAction({
    scoreState: "changed",
    currentTotal: 21,
    candidateTotal: 21,
    candidateSeenAt: "2026-10-03T00:00:00.000Z",
    nowMs
  }), { kind: "none" });
});

test("expires only after the same higher score stays confirmed for the full window", () => {
  const nowMs = Date.parse("2026-10-03T00:00:00.000Z") + LIVE_OFFER_SCORE_CONFIRMATION_MS;
  assert.deepEqual(liveOfferScoreCandidateAction({
    scoreState: "changed",
    currentTotal: 21,
    candidateTotal: 21,
    candidateSeenAt: "2026-10-03T00:00:00.000Z",
    nowMs
  }), { kind: "expire" });
});

test("resets confirmation when a different higher score appears", () => {
  const nowMs = Date.parse("2026-10-03T00:00:25.000Z");
  assert.deepEqual(liveOfferScoreCandidateAction({
    scoreState: "changed",
    currentTotal: 24,
    candidateTotal: 21,
    candidateSeenAt: "2026-10-03T00:00:00.000Z",
    nowMs
  }), {
    kind: "start",
    total: 24,
    seenAt: "2026-10-03T00:00:25.000Z"
  });
});

test("clears a pending confirmation when the score reverts or becomes uncertain", () => {
  for (const scoreState of ["unchanged", "uncertain"] as const) {
    assert.deepEqual(liveOfferScoreCandidateAction({
      scoreState,
      currentTotal: null,
      candidateTotal: 21,
      candidateSeenAt: "2026-10-03T00:00:00.000Z",
      nowMs: Date.parse("2026-10-03T00:00:05.000Z")
    }), { kind: "clear" });
  }
});
