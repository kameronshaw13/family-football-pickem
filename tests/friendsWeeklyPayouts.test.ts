import assert from "node:assert/strict";
import test from "node:test";
import { friendsWeeklyPositionPayouts } from "../lib/friendsWeeklyPayouts.ts";

const bankRules = {
  first: 40,
  second: 20,
  third: 0,
  fourth: 0,
  fifth: 0,
  sixth: -10,
  seventh: -20,
  eighth: -30,
  perfectMultiplier: 1.5,
  perfectPayouts: {
    first: 60,
    second: 20,
    third: 0,
    fourth: 0,
    fifth: 0,
    sixth: -15,
    seventh: -25,
    eighth: -40
  }
};

test("friends weekly uses configured normal payouts", () => {
  assert.deepEqual(friendsWeeklyPositionPayouts(bankRules, false), [40, 20, 0, 0, 0, -10, -20, -30]);
});

test("friends perfect week uses an explicit balanced payout table", () => {
  const payouts = friendsWeeklyPositionPayouts(bankRules, true);
  assert.deepEqual(payouts, [60, 20, 0, 0, 0, -15, -25, -40]);
  assert.equal(payouts.reduce((sum, value) => sum + value, 0), 0);
});


test("seven-player basketball payouts have two zero spots and balance to zero", () => {
  const basketballRules = {
    ...bankRules,
    positions: 7,
    fifth: -10,
    sixth: -20,
    seventh: -30,
    perfectPayouts: {
      first: 60,
      second: 20,
      third: 0,
      fourth: 0,
      fifth: -15,
      sixth: -25,
      seventh: -40
    }
  };
  const regular = friendsWeeklyPositionPayouts(basketballRules, false);
  assert.deepEqual(regular, [40, 20, 0, 0, -10, -20, -30]);
  assert.equal(regular.reduce((sum, value) => sum + value, 0), 0);
  const perfect = friendsWeeklyPositionPayouts(basketballRules, true);
  assert.deepEqual(perfect, [60, 20, 0, 0, -15, -25, -40]);
  assert.equal(perfect.reduce((sum, value) => sum + value, 0), 0);
});
