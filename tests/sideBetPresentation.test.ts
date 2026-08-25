import test from "node:test";
import assert from "node:assert/strict";
import { sideBetBettorForTeam, sideBetLedgerPerspective, sideBetOfferIsPending, sideBetPerspective, sideBetResponseSummary, sideBetsForView } from "../lib/sideBetPresentation.ts";
import type { SideBet } from "../lib/types.ts";

function bet(overrides: Partial<SideBet> = {}): SideBet {
  return {
    id: "bet-1",
    creator_id: "sender",
    game_id: "game-1",
    week: 1,
    creator_team: "Away Team",
    offered_team: "Home Team",
    creator_spread: 7.5,
    offered_spread: -7.5,
    amount: 20,
    status: "open",
    accepted_by: null,
    accepted_at: null,
    winner_id: null,
    result: "pending",
    created_at: "2026-08-21T12:00:00.000Z",
    updated_at: "2026-08-21T12:00:00.000Z",
    creator: { id: "sender", display_name: "Sender" },
    accepted_by_profile: null,
    targets: [{ side_bet_id: "bet-1", recipient_id: "recipient", response: "pending", responded_at: null, recipient: { id: "recipient", display_name: "Recipient" } }],
    ...overrides
  };
}

test("sender and recipient see their own team, spread, and logo perspective", () => {
  assert.deepEqual(sideBetPerspective(bet(), "sent"), { team: "Away Team", spread: 7.5 });
  assert.deepEqual(sideBetPerspective(bet(), "received"), { team: "Home Team", spread: -7.5 });
});

test("accepted offers remain visible in offer history", () => {
  const accepted = bet({ status: "accepted", accepted_by: "recipient" });
  assert.deepEqual(sideBetsForView([accepted], "sender", "sent").map((row) => row.id), ["bet-1"]);
  assert.deepEqual(sideBetsForView([accepted], "recipient", "received").map((row) => row.id), ["bet-1"]);
  assert.equal(sideBetOfferIsPending(accepted, "sender", "sent"), false);
  assert.equal(sideBetOfferIsPending(accepted, "recipient", "received"), false);
});

test("pending status follows the current recipient response", () => {
  const open = bet();
  assert.equal(sideBetOfferIsPending(open, "sender", "sent"), true);
  assert.equal(sideBetOfferIsPending(open, "recipient", "received"), true);

  const recipientDeclined = bet({
    targets: [{ side_bet_id: "bet-1", recipient_id: "recipient", response: "declined", responded_at: "2026-08-21T13:00:00.000Z", recipient: { id: "recipient", display_name: "Recipient" } }]
  });
  assert.equal(sideBetOfferIsPending(recipientDeclined, "recipient", "received"), false);
  assert.equal(sideBetOfferIsPending(recipientDeclined, "sender", "sent"), false);
});

test("a partial decline leaves the sender's offer pending for the remaining recipients", () => {
  const partialDecline = bet({
    targets: [
      { side_bet_id: "bet-1", recipient_id: "mike", response: "declined", responded_at: "2026-08-21T13:00:00.000Z", recipient: { id: "mike", display_name: "Mike" } },
      { side_bet_id: "bet-1", recipient_id: "quentin", response: "pending", responded_at: null, recipient: { id: "quentin", display_name: "Quentin" } }
    ]
  });

  assert.equal(sideBetOfferIsPending(partialDecline, "sender", "sent"), true);
  assert.deepEqual(sideBetResponseSummary(partialDecline, "sender", "sent"), {
    full: "Offered to Quentin",
    compact: "Offered to Quentin",
    tone: "pending"
  });
  assert.deepEqual(sideBetResponseSummary(partialDecline, "mike", "received"), {
    full: "You declined",
    compact: "You declined",
    tone: "declined"
  });
});

test("all declines name each recipient and compact larger groups without truncating every name", () => {
  const allDeclined = bet({
    status: "declined",
    targets: [
      { side_bet_id: "bet-1", recipient_id: "mike", response: "declined", responded_at: "2026-08-21T13:00:00.000Z", recipient: { id: "mike", display_name: "Mike" } },
      { side_bet_id: "bet-1", recipient_id: "quentin", response: "declined", responded_at: "2026-08-21T13:01:00.000Z", recipient: { id: "quentin", display_name: "Quentin" } }
    ]
  });
  assert.deepEqual(sideBetResponseSummary(allDeclined, "sender", "sent"), {
    full: "Mike and Quentin declined",
    compact: "Mike and Quentin declined",
    tone: "declined"
  });

  const fourPending = bet({
    targets: ["Mike", "Quentin", "Caleb", "Josh"].map((name) => ({
      side_bet_id: "bet-1",
      recipient_id: name.toLowerCase(),
      response: "pending" as const,
      responded_at: null,
      recipient: { id: name.toLowerCase(), display_name: name }
    }))
  });
  assert.deepEqual(sideBetResponseSummary(fourPending, "sender", "sent"), {
    full: "Offered to Mike, Quentin, Caleb, and Josh",
    compact: "Offered to Mike, Quentin +2",
    tone: "pending"
  });
});

test("ledger uses the current user's side when involved", () => {
  const accepted = bet({ status: "accepted", accepted_by: "recipient", accepted_by_profile: { id: "recipient", display_name: "Recipient" } });
  assert.deepEqual(sideBetLedgerPerspective(accepted, "sender"), { team: "Away Team", spread: 7.5, involvesUser: true });
  assert.deepEqual(sideBetLedgerPerspective(accepted, "recipient"), { team: "Home Team", spread: -7.5, involvesUser: true });
});

test("group ledger uses the favorite and maps bettors by away/home team", () => {
  const accepted = bet({ status: "accepted", accepted_by: "recipient", accepted_by_profile: { id: "recipient", display_name: "Recipient" } });
  assert.deepEqual(sideBetLedgerPerspective(accepted, "observer"), { team: "Home Team", spread: -7.5, involvesUser: false });
  assert.deepEqual(sideBetBettorForTeam(accepted, "Away Team"), { id: "sender", name: "Sender" });
  assert.deepEqual(sideBetBettorForTeam(accepted, "Home Team"), { id: "recipient", name: "Recipient" });
});
