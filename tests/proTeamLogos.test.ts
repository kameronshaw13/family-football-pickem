import test from "node:test";
import assert from "node:assert/strict";
import { teamVectorLogo } from "../lib/teamLogoSource.ts";
import { NBA_SVG_BY_ESPN_KEY, NFL_SVG_BY_ESPN_KEY } from "../lib/proLogos.ts";

test("NBA logos all use the official NBA SVG source", () => {
  assert.equal(new Set(Object.values(NBA_SVG_BY_ESPN_KEY)).size, 30);
  assert.equal(teamVectorLogo("https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/lac.png"), "https://cdn.nba.com/logos/nba/1610612746/global/L/logo.svg");
  assert.equal(teamVectorLogo("https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/lal.png"), "https://cdn.nba.com/logos/nba/1610612747/global/L/logo.svg");
});
test("NFL logos all use verified vector files", () => {
  assert.equal(new Set(Object.values(NFL_SVG_BY_ESPN_KEY)).size, 32);
  assert.match(teamVectorLogo("https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/kc.png") || "", /kansas-city-chiefs\.svg$/);
});
test("college mapping stays with NCAA vectors", () => {
  assert.equal(teamVectorLogo("https://a.espncdn.com/i/teamlogos/ncaa/500/2724.png"), "https://www.ncaa.com/sites/default/files/images/logos/schools/bgl/wichita-st.svg");
});
