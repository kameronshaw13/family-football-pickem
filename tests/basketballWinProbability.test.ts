import test from "node:test";
import assert from "node:assert/strict";
import { estimatedCoverPoints, nearestProbabilityPoint } from "../lib/basketballWinProbability.ts";

test("chart scrubbing chooses the nearest recorded play with its score and time", () => {
  const points = [{ id: "start", home: .5, progress: 0, period: 1, clock: "20:00", awayScore: 0, homeScore: 0 }, { id: "half", home: .65, progress: .5, period: 1, clock: "0:00", awayScore: 30, homeScore: 35 }, { id: "ot", home: .8, progress: 1.1, period: 3, clock: "1:00", awayScore: 80, homeScore: 84 }];
  assert.equal(nearestProbabilityPoint(points, -.1)?.id, "start");
  assert.deepEqual(nearestProbabilityPoint(points, .6), points[1]);
  assert.equal(nearestProbabilityPoint(points, 1.05)?.id, "ot");
  assert.equal(nearestProbabilityPoint(points, 2)?.id, "ot");
  assert.equal(nearestProbabilityPoint([], .5), null);
});

const opening = { id: "start", home: .7, progress: 0, period: 1, clock: "20:00", awayScore: 0, homeScore: 0 };
test("cover estimates use the opening line, respond to margin, and settle actual results", () => {
  const points = [opening, { ...opening, id: "half", progress: .5, period: 1, clock: "0:00", homeScore: 45, awayScore: 30 }, { ...opening, id: "final", progress: 1, period: 2, clock: "0:00", homeScore: 80, awayScore: 70 }];
  const result = estimatedCoverPoints(points, -7, true, true);
  assert.ok(Math.abs(result[0].home - .5) < .001);
  assert.ok(result[1].home > .5 && result[1].home < 1);
  assert.equal(result[2].home, 1);
  assert.equal(estimatedCoverPoints([{ ...opening }, { ...points[2], homeScore: 77 }], -7, true, true)[1].push, true);
  assert.equal(estimatedCoverPoints([{ ...opening }, { ...points[2], homeScore: 75 }], -7, true, true)[1].home, 0);
});
test("cover estimates do not invent a variance with missing or inconsistent opening inputs", () => {
  assert.deepEqual(estimatedCoverPoints([opening], null, true, false), []);
  assert.deepEqual(estimatedCoverPoints([{ ...opening, progress: .5 }], -7, true, false), []);
  assert.deepEqual(estimatedCoverPoints([opening], 7, true, false), []);
  assert.deepEqual(estimatedCoverPoints([{ ...opening, home: .5 }], -7, true, false), []);
  assert.deepEqual(estimatedCoverPoints([{ ...opening, homeScore: 3 }], -7, true, false), []);
});
test("a tied period at zero seconds continues into overtime rather than settling the cover", () => {
  const points = [opening, { ...opening, id: "reg-end", progress: 1, period: 2, clock: "0:00", homeScore: 70, awayScore: 70 }];
  const p = estimatedCoverPoints(points, -7, true, false)[1].home;
  assert.ok(p > 0 && p < .5);
});
