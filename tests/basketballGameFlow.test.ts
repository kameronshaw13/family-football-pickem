import assert from "node:assert/strict";
import test from "node:test";
import { basketballScoreFlow, basketballTimeProgress } from "../lib/basketballGameFlow.ts";
import { basketballPeriodLabel } from "../lib/basketballShots.ts";

test("NBA quarter clocks and decimal seconds use the same basketball timeline", () => {
  assert.equal(basketballTimeProgress(4, "0.0", false), 1);
  assert.equal(basketballTimeProgress(4, "21.4", false), basketballTimeProgress(4, "0:21.4", false));
  assert.ok(basketballTimeProgress(5, "0.0", false)! > 1);
  assert.equal(basketballTimeProgress(1, "", false), null);
  assert.equal(basketballTimeProgress(1, "12:01", false), null);
  assert.equal(basketballPeriodLabel(1, false), "Quarter 1");
  assert.equal(basketballPeriodLabel(1, true), "1st Half");
});

test("game flow scales for early scores, full final scores, and overtime", () => {
  const early = { awayScore: 16, homeScore: 20, progress: .2 };
  assert.equal(basketballScoreFlow([early]).ceiling, 40);
  const result = basketballScoreFlow([early], { away: 124, home: 131, period: 5, college: false });
  assert.deepEqual(result.ticks, [0, 40, 80, 120, 160]);
  assert.deepEqual(result.points.at(-1), { away: 124, home: 131, progress: result.domain });
  assert.ok(result.domain > 1);
});
