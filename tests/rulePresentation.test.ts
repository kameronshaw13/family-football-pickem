import test from "node:test";
import assert from "node:assert/strict";
import { ruleSections } from "../lib/rulePresentation.ts";

test("each Pick'em group presents its own rules", () => {
  const basketball = ruleSections("friends-basketball", { sport: "basketball" });
  const friends = ruleSections("friends");
  const shaw = ruleSections("shaw-family");
  const caleb = ruleSections("other-family");

  assert.match(basketball.find((section) => section.title === "Eligible Games")!.items.join(" "), /NBA regular season/);
  assert.match(basketball.find((section) => section.title === "Pick Locks")!.items.join(" "), /tipoff/);
  assert.doesNotMatch(basketball.flatMap((section) => section.items).join(" "), /CFB|NFL|kickoff/);
  assert.match(friends.find((section) => section.title === "Weekly Card")!.items.join(" "), /CFB\/NFL/);
  assert.match(shaw.find((section) => section.title === "Weekly Bank")!.items.join(" "), /pays first place/);
  assert.ok(caleb.some((section) => section.title === "Confidence Points"));
});

test("rules omit the internal side bet safety cap", () => {
  for (const group of ["shaw-family", "other-family", "friends", "friends-basketball"] as const) {
    assert.doesNotMatch(ruleSections(group).flatMap((section) => section.items).join(" "), /10,000|10000/);
  }
});
