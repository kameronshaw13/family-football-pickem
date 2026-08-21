import test from "node:test";
import assert from "node:assert/strict";
import { moveConfidencePick, normalizeConfidenceCard } from "../lib/confidencePoints.ts";
import type { Pick } from "../lib/types.ts";

function regular(id: string, points: number | null, status: Pick["status"] = "draft"): Pick {
  return { id, user_id: "player", game_id: id, week: 1, selected_team: id, pick_type: "regular", status, locked_spread: null, locked_spread_team: null, locked_at: null, underdog_win_value: null, confidence_points: points, result: "pending" };
}

test("removing a confidence pick compacts the remaining editable slots", () => {
  const normalized = normalizeConfidenceCard([regular("a", 5), regular("c", 3), regular("d", 2), regular("e", 1)], 5);
  assert.deepEqual(normalized.map((pick) => pick.confidence_points), [5, 4, 3, 2]);
});

test("locked confidence slots stay fixed while editable picks move around them", () => {
  const picks = [regular("a", 5), regular("b", 4), regular("c", 3, "locked"), regular("d", 2), regular("e", 1)];
  const moved = moveConfidencePick(picks, 1, 1, 5);
  assert.deepEqual(moved.map((pick) => pick.game_id), ["a", "d", "c", "b", "e"]);
  assert.equal(moved[2].confidence_points, 3);
  assert.deepEqual(moved.map((pick) => pick.confidence_points), [5, 4, 3, 2, 1]);
});
