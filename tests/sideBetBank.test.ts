import assert from "node:assert/strict";
import test from "node:test";
import { availableSideBetFunds, canCoverSideBetRisk, sideBetReservedFunds } from "../lib/sideBetBank.ts";
import { buildBankHistory } from "../lib/bankHistory.ts";

test("open offers reserve sender risk once, regardless of recipient count", () => {
  const reserved = sideBetReservedFunds([
    { status: "open", creator_id: "caleb", amount: 30, creator_odds: 100 },
    { status: "cancelled", creator_id: "caleb", amount: 100 },
    { status: "settled", creator_id: "caleb", amount: 50 }
  ]);
  assert.equal(reserved.caleb, 30);
  assert.equal(availableSideBetFunds(107.81, reserved.caleb), 77.81);
  assert.equal(canCoverSideBetRisk(77.81, 77.81), true);
  assert.equal(canCoverSideBetRisk(77.81, 77.82), false);
});

test("accepted bets reserve each player's true risk at asymmetric odds", () => {
  const reserved = sideBetReservedFunds([
    { status: "accepted", creator_id: "caleb", accepted_by: "isaac", amount: 40, creator_odds: 150 }
  ]);
  assert.deepEqual(reserved, { caleb: 40, isaac: 60 });
  assert.equal(availableSideBetFunds(100, reserved.isaac), 40);
  assert.equal(canCoverSideBetRisk(0, 10), false);
});

test("settlement offsets Week 7 and Week 8 deposit stays separate", () => {
  const history = buildBankHistory(
    [{ id: "wk7", week: 7, user_id: "mason", amount: -50, note: "Weekly Pick'em" }],
    [],
    [{ week: 8, user_id: "mason", opening_balance: 0, settlement_week: 7, settlement_amount: 50 },
     { week: 8, user_id: "kameron", opening_balance: 200, settlement_week: 7, settlement_amount: 0 }]
  );
  assert.equal(history.find((row) => row.week === 7)?.payoutAmounts.mason, 50);
  assert.equal(history.find((row) => row.week === 7)?.totals.mason, 0);
  assert.equal(history.find((row) => row.week === 8)?.openingBalances.kameron, 200);
  assert.equal(history.find((row) => row.week === 8)?.totals.kameron, undefined);
});
