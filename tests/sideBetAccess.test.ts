import assert from "node:assert/strict";
import test from "node:test";
import { isSideBetRestricted } from "../lib/sideBetAccess.ts";

const masonId = "331cf3d9-6df4-45b1-b3ec-5db6e08eb411";
const friendsRules = { sideBets: { blockedUserIds: [masonId] } };

test("Friends can exclude Mason from side bets", () => {
  assert.equal(isSideBetRestricted(friendsRules, masonId), true);
  assert.equal(isSideBetRestricted(friendsRules, "caleb-profile"), false);
});

test("Other leagues have normal side bet access", () => {
  assert.equal(isSideBetRestricted({ sideBets: { enabled: true } }, masonId), false);
  assert.equal(isSideBetRestricted(null, masonId), false);
});
