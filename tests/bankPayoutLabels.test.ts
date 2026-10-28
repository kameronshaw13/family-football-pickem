import assert from "node:assert/strict";
import test from "node:test";
import { bankPayoutLabels } from "../lib/bankPayoutLabels.ts";

test("settlements show distinct week ranges, newest first or last", () => {
  const weeks: Array<{ week: number; payoutAmounts: Record<string, number> }> = [
    { week: 10, payoutAmounts: {} },
    { week: 9, payoutAmounts: { mason: -15 } },
    { week: 8, payoutAmounts: {} },
    { week: 7, payoutAmounts: { mason: 40 } }
  ];
  const labels = bankPayoutLabels(weeks);
  assert.equal(labels.get(7), "Weeks 1-7 Payout");
  assert.equal(labels.get(9), "Weeks 8-9 Payout");
  assert.equal(labels.has(10), false);
});

test("a single-week settlement uses singular Week", () => {
  const labels = bankPayoutLabels([{ week: 1, payoutAmounts: { a: 0 } }]);
  assert.equal(labels.get(1), "Week 1 Payout");
});
