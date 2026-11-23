import test from "node:test";
import assert from "node:assert/strict";
import type { BankEntry, Profile, SideBet } from "../lib/types.ts";
import { acceptedSideBetExposure, bankLeaderboardTotals, weeklyBankAmounts } from "../lib/bankPresentation.ts";

const profiles = [
  { id: "a", display_name: "Alpha" },
  { id: "b", display_name: "Beta" },
  { id: "c", display_name: "Charlie" }
] as Profile[];
const entries = [
  { user_id: "a", week: 2, amount: 30 },
  { user_id: "a", week: 2, amount: -10 },
  { user_id: "a", week: 3, amount: 4 },
  { user_id: "b", week: 2, amount: -20 }
] as BankEntry[];

const bet = (creator_id: string, accepted_by: string | null, status: SideBet["status"], amount: number, odds = 150) =>
  ({ creator_id, accepted_by, status, amount, creator_odds: odds } as SideBet);

test("weekly bank amounts are per week and distinguish missing entries from zero", () => {
  assert.deepEqual(weeklyBankAmounts(profiles, entries, 2, true), { a: 20, b: -20, c: null });
  assert.deepEqual(weeklyBankAmounts(profiles, entries, 2, false), {});
  assert.deepEqual(weeklyBankAmounts(profiles, entries, 3, true), { a: 4, b: null, c: null });
});

test("saved credit balances take priority outside preview", () => {
  const totals = bankLeaderboardTotals({
    profiles, entries, sideBetBankTotals: { a: -4, b: 10 },
    bankBalances: { a: 0, b: 120 },
    previewActive: false, active: true
  });
  assert.deepEqual(totals.map(p => [p.id, p.total]), [["b", 120], ["a", 0], ["c", 0]]);
});

test("preview and missing saved bank balances derive totals from entries and bets", () => {
  const totals = bankLeaderboardTotals({
    profiles, entries, sideBetBankTotals: { a: -4, b: 10 },
    bankBalances: { a: 999 }, previewActive: true, active: true
  });
  assert.deepEqual(totals.map(p => [p.id, p.total]), [["a", 20], ["c", 0], ["b", -10]]);
  assert.deepEqual(bankLeaderboardTotals({ profiles, entries, active: false, previewActive: false }), []);
});

test("accepted exposure counts creator and acceptor at symmetrical fair-risk amounts", () => {
  const bets = [
    bet("a", "b", "accepted", 20, 150),
    bet("b", "a", "accepted", 30, -150),
    bet("a", null, "open", 999),
    bet("a", "b", "settled", 200),
    bet("b", "c", "accepted", 40)
  ];
  const actual = acceptedSideBetExposure(bets, "a");
  assert.equal(actual.activeCount, 2);
  assert.equal(actual.activeBets.length, 2);
  assert.ok(actual.potentialProfit > 0);
  assert.ok(actual.potentialLoss > 0);
  assert.deepEqual(acceptedSideBetExposure(bets, "nobody"), { activeBets: [], activeCount: 0, potentialProfit: 0, potentialLoss: 0 });
  assert.equal(bets.length, 5);
});
