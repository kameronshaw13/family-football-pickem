import test from "node:test";
import assert from "node:assert/strict";
import { accessibleLeaguesForUser, isKnownPickemUser } from "../lib/leagueAccess.ts";

const allGroups = [
  { slug: "shaw-family", role: "admin" as const },
  { slug: "friends", role: "member" as const },
  { slug: "friends-basketball", role: "member" as const },
  { slug: "other-family", role: "member" as const }
];

test("one profile sees only its active roster memberships", () => {
  assert.deepEqual(accessibleLeaguesForUser("kameron", allGroups).map((league) => league.slug), ["shaw-family", "friends", "friends-basketball"]);
  assert.deepEqual(accessibleLeaguesForUser("Caleb", allGroups).map((league) => league.slug), ["other-family", "friends", "friends-basketball"]);
  assert.deepEqual(accessibleLeaguesForUser("mike", allGroups).map((league) => league.slug), ["shaw-family"]);
  assert.deepEqual(accessibleLeaguesForUser("monte", allGroups).map((league) => league.slug), ["other-family"]);
});

test("league selector uses the public display names without changing routes or memberships", () => {
  assert.deepEqual(accessibleLeaguesForUser("caleb", allGroups).map(({ name, homePath }) => ({ name, homePath })), [
    { name: "Caleb’s Family Football", homePath: "/caleb-family" },
    { name: "Just Cover Football", homePath: "/friends" },
    { name: "Just Cover Basketball", homePath: "/friends-basketball" }
  ]);
});

test("a missing or inactive database membership never becomes available from the roster alone", () => {
  assert.deepEqual(accessibleLeaguesForUser("kameron", [{ slug: "friends", role: "admin" }]).map((league) => league.slug), ["friends"]);
  assert.deepEqual(accessibleLeaguesForUser("kameron", [{ slug: "made-up", role: "admin" }]), []);
  assert.deepEqual(accessibleLeaguesForUser("stranger", allGroups), []);
});

test("unified sign-in accepts a known roster name without choosing a league", () => {
  assert.equal(isKnownPickemUser(" Quentin "), true);
  assert.equal(isKnownPickemUser("caleb"), true);
  assert.equal(isKnownPickemUser("unknown"), false);
});
