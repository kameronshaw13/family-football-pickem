import test from "node:test";
import assert from "node:assert/strict";
import { groupTrackerScoringPlays } from "../lib/trackerScoringGroups.ts";

test("quarter headers occur only at real scoring period boundaries", () => {
  const plays = [
    { period: "1", id: "a", awayScore: 7 },
    { period: "1", id: "b", awayScore: 7 },
    { period: "2", id: "c", awayScore: 14 },
    { period: "3", id: "d", awayScore: 21 },
    { period: "3", id: "e", awayScore: 21 }
  ];
  const groups = groupTrackerScoringPlays(plays, value => value === "1" ? "1st" : value === "2" ? "2nd" : "3rd");
  assert.deepEqual(groups.map(group => [group.label, group.rows.length]), [["1st",2],["2nd",1],["3rd",2]]);
  assert.equal(groups[1].rows[0].previous?.id, "b");
  assert.equal(groups[2].rows[0].previous?.id, "c");
});
test("empty and single-score games don't invent dividers", () => {
  assert.deepEqual(groupTrackerScoringPlays([], x => x), []);
  const one = groupTrackerScoringPlays([{id:"x",period:"4"}], x=>x);
  assert.equal(one.length,1);
  assert.equal(one[0].rows[0].previous,undefined);
});
