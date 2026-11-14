import assert from "node:assert/strict";
import test from "node:test";
import { shouldHideOwnSideBets, visibleOwnSideBetOffers, visibleSideBetLedger } from "../lib/sideBetVisibility.ts";

const ledger = [
  { id: "mine-sent", status: "accepted", creator_id: "me", accepted_by: "alex" },
  { id: "mine-received", status: "settled", creator_id: "alex", accepted_by: "me" },
  { id: "others-active", status: "accepted", creator_id: "alex", accepted_by: "jordan" },
  { id: "others-settled", status: "settled", creator_id: "jordan", accepted_by: "alex" },
  { id: "others-pending", status: "open", creator_id: "alex", accepted_by: null }
];

test("hidden mode removes only my ledger bets while retaining others", () => {
  assert.deepEqual(visibleSideBetLedger(ledger, "me", true).map(bet => bet.id), ["others-active", "others-settled"]);
});

test("off mode restores all accepted/settled ledger bets", () => {
  assert.deepEqual(visibleSideBetLedger(ledger, "me", false).map(bet => bet.id), ["mine-sent", "mine-received", "others-active", "others-settled"]);
});

test("hidden mode makes sent, received and history offers all appear empty", () => {
  const offers = [{ id: "pending" }, { id: "declined" }, { id: "accepted" }, { id: "settled" }];
  assert.deepEqual(visibleOwnSideBetOffers(offers, true), []);
  assert.deepEqual(visibleOwnSideBetOffers(offers, false), offers);
});

test("Kameron's hide switch cannot hide Quentin's bets", () => {
  assert.equal(shouldHideOwnSideBets("kameron-id", "kameron", "kameron-id", true), true);
  assert.equal(shouldHideOwnSideBets("quentin-id", "quentin", "kameron-id", true), false);
  assert.equal(shouldHideOwnSideBets("quentin-id", "quentin", "quentin-id", true), false);
  assert.deepEqual(visibleOwnSideBetOffers([{ id: "quentin-bet" }], false), [{ id: "quentin-bet" }]);
});
