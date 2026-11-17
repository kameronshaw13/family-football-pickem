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

test("compact ESPN PersonalFoul events count toward the current half", () => {
  assert.equal(basketballSituation(null, "away", false, competitor, [{ ...foul(2), type: { text: "PersonalFoul" }, text: "Foul on Player." }], 2, true).fouls, 1);
});

test("team timeouts can be reconstructed from complete play-by-play, excluding TV breaks", () => {
  const start = { text: "Start game", period: { number: 1 }, clock: { displayValue: "20:00" } };
  const timeout = (period: number, type = "ShortTimeOut") => ({ team: { id: "a" }, period: { number: period }, type: { text: type } });
  assert.equal(basketballSituation(null, "away", false, competitor, [start], 1, true).timeoutsRemaining, 4);
  assert.equal(basketballSituation(null, "away", false, competitor, [start], 2, true).timeoutsRemaining, 3);
  assert.equal(basketballSituation(null, "away", false, competitor, [start, timeout(1), timeout(2), timeout(2, "OfficialTVTimeOut")], 2, true).timeoutsRemaining, 2);
  assert.equal(basketballSituation(null, "away", false, competitor, [start, timeout(1, "RegularTimeOut")], 2, true).timeoutsRemaining, 2);
  assert.equal(basketballSituation(null, "away", false, competitor, [start, timeout(1)], 3, true).timeoutsRemaining, 4);
  assert.equal(basketballSituation(null, "away", false, competitor, [timeout(2)], 2, true).timeoutsRemaining, null);
});

test("an all-zero core placeholder does not overwrite actual recorded fouls and timeouts", () => {
  const situation = { homeTimeouts: { timeoutsRemainingCurrent: 0 }, awayTimeouts: { timeoutsRemainingCurrent: 0 }, homeFouls: { teamFoulsCurrent: 0 }, awayFouls: { teamFoulsCurrent: 0 } };
  const plays = [{ text: "Start game", period: { number: 1 } }, { ...foul(2), type: { text: "PersonalFoul" } }];
  const result = basketballSituation(situation, "away", false, competitor, plays, 2, true);
  assert.equal(result.fouls, 1);
  assert.equal(result.timeoutsRemaining, 3);
});

test("complete team timeout history overrides core zero defaults even when core fouls are populated", () => {
  const plays = [{ text: "Start game", period: { number: 1 } }, { team: { id: "a" }, period: { number: 2 }, type: { text: "ShortTimeOut" } }];
  const result = basketballSituation({ awayTimeouts: { timeoutsRemainingCurrent: 0 }, awayFouls: { teamFoulsCurrent: 7 } }, "away", false, competitor, plays, 2, true);
  assert.equal(result.timeoutsRemaining, 2);
  assert.equal(result.fouls, 7);
});
