import test from "node:test";
import assert from "node:assert/strict";
import { parseHistoricalLogos, findArchivedTeam } from "../lib/logoHistoryParser.ts";
import { logoKeyFromSource } from "../lib/logoStudio.ts";
import { curatedLogoAlternatives } from "../lib/logoExtraOptions.ts";

test("historical archive does not leak another team's crest across headings", () => {
  const html = [
    "<h3>Los Angeles Clippers</h3>",
    '<img src="https://assets.logocdn.com/images/sports/nba/2015/los-angeles-clippers@3x.png">',
    // The next franchise's current icon appears before its heading on the site.
    '<img src="https://assets.logocdn.com/images/sports/nba/2023/los-angeles-lakers@3x.png">',
    "<h3>Los Angeles Lakers</h3>",
    '<img src="https://assets.logocdn.com/images/sports/nba/1976/los-angeles-lakers@3x.png">',
    '<img src="https://assets.logocdn.com/images/sports/nba/1955/minneapolis-lakers@3x.png">',
  ].join("\n");
  const teams = parseHistoricalLogos(html, "nba");
  const clippers = findArchivedTeam(teams, "LA Clippers");
  const lakers = findArchivedTeam(teams, "Los Angeles Lakers");
  assert.equal(clippers?.logos.length, 1);
  assert.ok(clippers?.logos.every(l => l.url.includes("clippers")));
  assert.equal(lakers?.logos.length, 2);
  assert.ok(lakers?.logos.every(l => l.url.includes("lakers")));
  assert.equal(findArchivedTeam(teams, "LA Chargers"), undefined);
});

test("per-team logo keys do not swap teams or sports", () => {
  const nbaClippers = "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/lac.png";
  const nbaLakers = "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/lal.png";
  const nflChargers = "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/lac.png";
  const nbaClipperKey = logoKeyFromSource(nbaClippers);
  assert.equal(nbaClipperKey, "cbs:344");
  assert.equal(logoKeyFromSource(nbaLakers), "cbs:345");
  assert.notEqual(logoKeyFromSource(nflChargers), nbaClipperKey);
});

test("supplementary LA logos are offered only to the exact team and league", () => {
  const clippers = "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/lac.png";
  const lakers = "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/lal.png";
  const chargers = "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/lac.png";
  const school = "https://a.espncdn.com/i/teamlogos/ncaa/500/27.png";
  assert.ok(curatedLogoAlternatives(clippers, "NBA").some(opt => opt.label.includes("Clippers full round")));
  assert.ok(curatedLogoAlternatives(lakers, "NBA").some(opt => opt.label.includes("Lakers basketball")));
  assert.ok(!curatedLogoAlternatives(chargers, "NFL").some(opt => opt.label.includes("Clippers")));
  assert.ok(curatedLogoAlternatives(school, "CBB").some(opt => opt.label.includes("Riverside")));
});
