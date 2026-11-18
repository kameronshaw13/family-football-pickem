import test from "node:test";
import assert from "node:assert/strict";
import { teamVectorLogo, teamVectorFallbackLogo } from "../lib/teamLogoSource.ts";
import { CBS_BY_ESPN_GUID, CBS_BY_LEAGUE } from "../lib/cbsLogos.ts";

test("CBS mappings cover all 30 NBA and 32 NFL clubs", () => {
  assert.equal(new Set(Object.values(CBS_BY_LEAGUE.nba)).size, 30);
  assert.equal(new Set(Object.values(CBS_BY_LEAGUE.nfl)).size, 32);
});

test("NBA uses the CBS GameTracker /alt/ artwork, not the directory logo", () => {
  const clipper = "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/lac.png";
  assert.equal(teamVectorLogo(clipper), "https://sports.cbsimg.net/fly/images/team-logos/alt/344.svg");
  assert.equal(teamVectorFallbackLogo(clipper), "https://sports.cbsimg.net/fly/images/team-logos/344.svg");
  assert.equal(teamVectorLogo("https://a.espncdn.com/i/teamlogos/nba/500/lal.png"), "https://sports.cbsimg.net/fly/images/team-logos/alt/345.svg");
});

test("NFL and college resolve to CBS GameTracker variants too", () => {
  assert.equal(teamVectorLogo("https://a.espncdn.com/i/teamlogos/nfl/500/kc.png"), "https://sports.cbsimg.net/fly/images/team-logos/alt/417.svg");
  assert.equal(teamVectorLogo("https://a.espncdn.com/i/teamlogos/ncaa/500/2724.png"), "https://sports.cbsimg.net/fly/images/team-logos/alt/21313.svg");
});

test("GUID logos stay mapped, unrelated sites are left unchanged", () => {
  const [guid, asset] = Object.entries(CBS_BY_ESPN_GUID)[0];
  assert.equal(teamVectorLogo("https://a.espncdn.com/guid/" + guid + "/logos/primary_logo_on_white_color.png"), "https://sports.cbsimg.net/fly/images/team-logos/alt/" + asset + ".svg");
  assert.equal(teamVectorLogo("https://example.com/logo.png"), null);
});
