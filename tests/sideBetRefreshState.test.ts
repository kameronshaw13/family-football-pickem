import test from "node:test";
import assert from "node:assert/strict";
import type { Game, SideBet } from "../lib/types.ts";
import {
  sideBetSyncSignature, sideBetLedgerSignature, canApplySideBetSnapshot,
  reconcileSideBetSnapshot, sideBetRequestWithVisibleScores
} from "../lib/sideBetRefreshState.ts";

const game = (id: string, fields: Partial<Game> = {}) => ({ id, ...fields } as Game);
const bet = (id: string, fields: Partial<SideBet> = {}) => ({
  id, game_id: "g1", status: "open", updated_at: "2026-11-23T00:00:00Z",
  creator_id: "a", accepted_by: null, result: "pending", winner_id: null,
  ...fields
} as SideBet);

test("side bet fingerprints ignore order but catch responses and settlement", () => {
  const a = bet("a", { targets: [{ side_bet_id: "a", recipient_id: "u", response: "pending", responded_at: null }] });
  const b = bet("b");
  assert.equal(sideBetSyncSignature([a, b]), sideBetSyncSignature([b, a]));
  assert.notEqual(sideBetSyncSignature([a]), sideBetSyncSignature([bet("a", { status: "accepted" })]));
  assert.notEqual(sideBetSyncSignature([a]), sideBetSyncSignature([bet("a", { targets: [{ side_bet_id: "a", recipient_id: "u", response: "accepted", responded_at: null }] })]));
  assert.equal(sideBetLedgerSignature([a, b]), sideBetLedgerSignature([b, a]));
  assert.notEqual(sideBetLedgerSignature([a]), sideBetLedgerSignature([bet("a", { winner_id: "u" })]));
});

test("older poll responses never overwrite a newer request or mutation", () => {
  assert.equal(canApplySideBetSnapshot(10, 11, 9), false);
  assert.equal(canApplySideBetSnapshot(10, 10, 11), false);
  assert.equal(canApplySideBetSnapshot(11, 11, 10), true);
  assert.equal(canApplySideBetSnapshot(11, 11, 11), true);
});

test("reconciliation attaches authoritative current game and preserves identity without changes", () => {
  const currentGame = game("g1", { home_team: "Current" });
  const old = bet("a", { game: currentGame });
  const current = { sideBets: [old], sideBetSlotCounts: { a: 2 }, games: [currentGame], untouched: "keep" };
  const same = reconcileSideBetSnapshot(current, { sideBets: [old] });
  assert.strictEqual(same, current);
  const changed = reconcileSideBetSnapshot(current, { sideBets: [bet("a", { status: "accepted" })], sideBetSlotCounts: { a: 1 } });
  assert.notStrictEqual(changed, current);
  assert.equal(changed.sideBets[0].game, currentGame);
  assert.equal(changed.sideBetSlotCounts.a, 1);
  assert.equal(changed.untouched, "keep");
  assert.equal(current.sideBets[0].status, "open");
});

test("accepting live bet attaches only visible game scores; other actions unchanged", () => {
  const current = {
    sideBets: [bet("a", { offer_phase: "live" }), bet("b", { offer_phase: "pregame" })],
    games: [game("g1", { live_home_score: 7, live_away_score: 3 })]
  };
  assert.deepEqual(sideBetRequestWithVisibleScores({ action: "accept", sideBetId: "a" }, current), {
    action: "accept", sideBetId: "a", visibleLiveHomeScore: 7, visibleLiveAwayScore: 3
  });
  const pre = { action: "accept", sideBetId: "b" };
  const create = { action: "create", sideBetId: "a" };
  assert.strictEqual(sideBetRequestWithVisibleScores(pre, current), pre);
  assert.strictEqual(sideBetRequestWithVisibleScores(create, current), create);
});
