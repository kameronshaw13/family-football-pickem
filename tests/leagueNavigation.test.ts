import test from "node:test";
import assert from "node:assert/strict";
import { leagueTabDestination, leagueTabFromQuery } from "../lib/leagueNavigation.ts";

const basketball = { slug: "friends-basketball" as const, homePath: "/friends-basketball" };

test("selecting a league in settings does not navigate until another tab opens", () => {
  assert.equal(leagueTabDestination("shaw-family", basketball, "settings"), null);
  assert.equal(leagueTabDestination("shaw-family", basketball, "picks"), "/friends-basketball?view=picks");
  assert.equal(leagueTabDestination("shaw-family", basketball, "card"), "/friends-basketball?view=card");
  assert.equal(leagueTabDestination("shaw-family", basketball, "standings"), "/friends-basketball?view=standings");
  assert.equal(leagueTabDestination("friends-basketball", basketball, "picks"), null);
  assert.equal(leagueTabDestination("shaw-family", null, "card"), null);
});

test("destination tab is limited to the app's real navigation tabs", () => {
  assert.equal(leagueTabFromQuery("card"), "card");
  assert.equal(leagueTabFromQuery("settings"), "settings");
  assert.equal(leagueTabFromQuery("something-else"), null);
  assert.equal(leagueTabFromQuery(null), null);
});

import { preferredLeagueForLaunch } from "../lib/leagueAccess.ts";
import type { LeagueMembership } from "../lib/leagueAccess.ts";
const assignedLeagues: LeagueMembership[] = [
  { slug: "shaw-family", name: "Shaw Family Football", homePath: "/", sport: "Football", role: "member" },
  { slug: "friends-basketball", name: "Just Cover Basketball", homePath: "/friends-basketball", sport: "Basketball", role: "member" }
];

test("launch uses saved league or the first available league", () => {
  assert.equal(preferredLeagueForLaunch(assignedLeagues, "friends-basketball")?.homePath, "/friends-basketball");
  assert.equal(preferredLeagueForLaunch(assignedLeagues, "other-family")?.homePath, "/");
  assert.equal(preferredLeagueForLaunch(assignedLeagues, null)?.homePath, "/");
  assert.equal(preferredLeagueForLaunch([], null), null);
});
