import test from "node:test";
import assert from "node:assert/strict";
import { teamSvgLogo } from "../lib/teamLogoSource.ts";
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

test("unknown teams, unsupported sports, branding and unrelated hosts keep the original source", () => {
  for (const source of ["https://a.espncdn.com/i/teamlogos/ncaa/500/9999999.png", "https://a.espncdn.com/i/teamlogos/mlb/500/bos.png", "/league-basketball.png", "https://unrelated.example/i/teamlogos/ncaa/500/2724.png", "https://a.espncdn.com.evil.example/i/teamlogos/ncaa/500/2724.png"]) assert.equal(teamSvgLogo(source), null);
});
