import test from "node:test";
import assert from "node:assert/strict";
import { basketballSituation } from "../lib/basketballSituation.ts";

const competitor = { team: { id: "a" } };
const foul = (period: number) => ({ team: { id: "a" }, period: { number: period }, type: { text: "Personal Foul" } });

test("reads ESPN's flat timeout and foul fields with team orientation", () => {
  const situation = { homeTimeouts: { timeoutsRemainingCurrent: 3 }, homeFouls: { teamFoulsCurrent: 7, bonusState: "NONE" }, awayTimeouts: { timeoutsRemainingCurrent: 1 }, awayFouls: { teamFoulsCurrent: 2, bonusState: "BONUS" } };
  assert.deepEqual(basketballSituation(situation, "away", true, competitor, [], 2, true), { timeoutsRemaining: 3, fouls: 7, bonus: 0 });
  assert.deepEqual(basketballSituation(situation, "home", true, competitor, [], 2, true), { timeoutsRemaining: 1, fouls: 2, bonus: 1 });
});

test("fallback counts team fouls per half and carries the second half into overtime", () => {
  const plays = [foul(1), foul(1), foul(2), foul(3), { ...foul(2), team: { id: "b" } }, { ...foul(2), type: { text: "Timeout" } }];
  assert.equal(basketballSituation(null, "away", false, competitor, plays, 1, true).fouls, 2);
  assert.equal(basketballSituation(null, "away", false, competitor, plays.slice(0, 3), 2, true).fouls, 1);
  assert.equal(basketballSituation(null, "away", false, competitor, plays, 3, true).fouls, 2);
  assert.equal(basketballSituation(null, "away", false, competitor, plays, 3, false).fouls, 1);
});

test("missing live data stays unknown rather than inventing zero timeouts", () => {
  assert.deepEqual(basketballSituation(null, "away", false, competitor, [], 1, true), { timeoutsRemaining: null, fouls: null, bonus: null });
  assert.equal(basketballSituation(null, "away", false, { ...competitor, timeoutsUsed: 1 }, [], 1, true).timeoutsRemaining, 3);
});
