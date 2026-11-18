import test from "node:test";
import assert from "node:assert/strict";
import { parseDivisionOneTeams } from "../lib/d1LogoDirectory.ts";
import { getPublishedLogoCollections, logoKeyFromSource, resolvePersonalLogo, setPublishedLogoCollection } from "../lib/logoStudio.ts";

test("one College directory uses canonical NCAA IDs shared by football and basketball", () => {
  const feed = { sports: [{ leagues: [{ teams: [
    { team: { id: "2724", displayName: "Wichita State Shockers" } },
    { team: { id: "27", displayName: "UC Riverside Highlanders" } },
    { team: { id: "2724", displayName: "Wichita State Shockers" } }
  ] }] }] };
  const teams = parseDivisionOneTeams(feed);
  assert.equal(teams.length, 2);
  assert.ok(teams.every(team => team.league === "College"));
  const riverside = teams.find(team => team.name.includes("Riverside"));
  assert.ok(riverside);
  assert.equal(riverside.key, logoKeyFromSource("https://a.espncdn.com/i/teamlogos/ncaa/500/27.png"));
});

test("a saved logo is reused by any scoreboard source with the same team identity", () => {
  const shared = "https://sports.cbsimg.net/fly/images/team-logos/344.svg";
  setPublishedLogoCollection("modern", { "cbs:344": shared });
  assert.equal(getPublishedLogoCollections().modern["cbs:344"], shared);
  assert.equal(resolvePersonalLogo("https://a.espncdn.com/i/teamlogos/nba/500/lac.png"), shared);
  assert.equal(resolvePersonalLogo("https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/lac.png"), shared);
  assert.equal(resolvePersonalLogo("https://a.espncdn.com/i/teamlogos/nba/500/lal.png"), null);
});

test("unsafe or invalid published logo URLs are not accepted", () => {
  setPublishedLogoCollection("modern", {
    "cbs:344": "http://localhost/internal.png",
    "nba:lal": "https://example.com/safe.png"
  });
  assert.equal(getPublishedLogoCollections().modern["cbs:344"], undefined);
  assert.equal(getPublishedLogoCollections().modern["nba:lal"], "https://example.com/safe.png");
});
