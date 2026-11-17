import test from "node:test";
import assert from "node:assert/strict";
import { nearestProbabilityPoint } from "../lib/basketballWinProbability.ts";

test("chart scrubbing chooses the nearest recorded play with its score and time", () => {
  const points = [{ id: "start", home: .5, progress: 0, period: 1, clock: "20:00", awayScore: 0, homeScore: 0 }, { id: "half", home: .65, progress: .5, period: 1, clock: "0:00", awayScore: 30, homeScore: 35 }, { id: "ot", home: .8, progress: 1.1, period: 3, clock: "1:00", awayScore: 80, homeScore: 84 }];
  assert.equal(nearestProbabilityPoint(points, -.1)?.id, "start");
  assert.deepEqual(nearestProbabilityPoint(points, .6), points[1]);
  assert.equal(nearestProbabilityPoint(points, 1.05)?.id, "ot");
  assert.equal(nearestProbabilityPoint(points, 2)?.id, "ot");
  assert.equal(nearestProbabilityPoint([], .5), null);
});
