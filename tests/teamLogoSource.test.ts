import test from "node:test";
import assert from "node:assert/strict";
import { isTeamLogoSource, teamSvgLogo } from "../lib/teamLogoSource.ts";
import { CBS_BY_ESPN_GUID, CBS_BY_LEAGUE } from "../lib/cbsLogos.ts";

const cbs = (id: string) => `https://sports.cbsimg.net/fly/images/team-logos/${id}.svg`;

test("college sources use CBS school identities, including renamed East Texas A&M", () => {
  assert.equal(teamSvgLogo("https://a.espncdn.com/i/teamlogos/ncaa/500/2724.png"), cbs("21313"));
  assert.equal(teamSvgLogo("https://secure.espncdn.com/i/teamlogos/ncaa/500-dark/2837.png?size=80"), cbs("26633132"));
});

test("pro numeric and abbreviation sources stay scoped to their league", () => {
  assert.equal(teamSvgLogo("https://a.espncdn.com/i/teamlogos/nba/500/bos.png"), cbs("334"));
  assert.equal(teamSvgLogo("https://a.espncdn.com/i/teamlogos/nba/500/2.png"), cbs("334"));
  assert.equal(teamSvgLogo("https://a.espncdn.com/i/teamlogos/nfl/500/kc.png"), cbs("417"));
  assert.notEqual(teamSvgLogo("https://a.espncdn.com/i/teamlogos/ncaa/500/2.png"), cbs("334"));
});

test("all 30 NBA and 32 NFL teams have both abbreviation and numeric mappings", () => {
  for (const [league, count] of [["nba", 30], ["nfl", 32]] as const) {
    const map = CBS_BY_LEAGUE[league];
    assert.equal(Object.keys(map).filter(key => /^\d+$/.test(key)).length, count);
    assert.equal(Object.keys(map).filter(key => /^[a-z]+$/.test(key)).length, count);
    assert.equal(new Set(Object.values(map)).size, count);
  }
});

test("ESPN GUID sources resolve to the verified CBS asset", () => {
  for (const [guid, asset] of Object.entries(CBS_BY_ESPN_GUID)) {
    assert.equal(teamSvgLogo(`https://a.espncdn.com/guid/${guid}/logos/primary_logo_on_white_color.png`), cbs(asset));
  }
});

test("unmapped IDs and unrelated images have no CBS lookup", () => {
  for (const source of ["https://a.espncdn.com/i/teamlogos/ncaa/500/9999999.png", "https://a.espncdn.com/i/teamlogos/mlb/500/bos.png", "/league-basketball.png", "https://unrelated.example/i/teamlogos/ncaa/500/2724.png", "https://a.espncdn.com.evil.example/i/teamlogos/ncaa/500/2724.png"]) assert.equal(teamSvgLogo(source), null);
});

test("the Clippers and Lakers use the same logo provider as the rest of the NBA", () => {
  for (const [key, asset] of [["lac", "344"], ["12", "344"], ["lal", "345"], ["13", "345"]]) {
    const source = `https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/${key}.png`;
    assert.equal(teamSvgLogo(source), cbs(asset));
  }
  const unmapped = "https://a.espncdn.com/i/teamlogos/ncaa/500/9999999.png";
  assert.equal(isTeamLogoSource(unmapped), true);
  assert.equal(teamSvgLogo(unmapped), null);
  assert.equal(isTeamLogoSource("/basketball-pickem-logo.png"), false);
});

test("team logos resolve to a single colored SVG source", () => {
  for (const [league, id, expected] of [
    ["nba", "2", "334"], ["nfl", "kc", "417"], ["ncaa", "2724", "21313"]
  ] as const) {
    const source = `https://a.espncdn.com/i/teamlogos/${league}/500/${id}.png`;
    const alternate = `https://secure.espncdn.com/i/teamlogos/${league}/500-dark/${id}.png`;
    assert.equal(teamSvgLogo(source), cbs(expected));
    assert.equal(teamSvgLogo(alternate), cbs(expected));
  }
});
