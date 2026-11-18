import test from "node:test";
import assert from "node:assert/strict";
import { ncaaSvgLogo } from "../lib/teamLogoSource.ts";
import { NCAA_SVG_BY_ESPN_GUID, NCAA_SVG_BY_ESPN_ID } from "../lib/ncaaLogos.ts";

test("college numeric logo URLs resolve to the verified school SVG", () => {
  assert.equal(ncaaSvgLogo("https://a.espncdn.com/i/teamlogos/ncaa/500/2724.png"), "https://www.ncaa.com/sites/default/files/images/logos/schools/bgl/wichita-st.svg");
  assert.equal(ncaaSvgLogo("https://a.espncdn.com/i/teamlogos/ncaa/500-dark/2305.png?size=80"), "https://www.ncaa.com/sites/default/files/images/logos/schools/bgl/kansas.svg");
});

test("ESPN's GUID logo format identifies the same verified school", () => {
  const [guid, slug] = Object.entries(NCAA_SVG_BY_ESPN_GUID)[0];
  assert.equal(ncaaSvgLogo(`https://a.espncdn.com/guid/${guid}/logos/primary_logo_on_white_color.png`), `https://www.ncaa.com/sites/default/files/images/logos/schools/bgl/${slug}.svg`);
});

test("pro teams, unknown schools, local branding and unrelated hosts retain their original sources", () => {
  for (const source of ["https://a.espncdn.com/i/teamlogos/nfl/500/ari.png", "https://a.espncdn.com/i/teamlogos/nba/500/1610612738.png", "https://a.espncdn.com/i/teamlogos/ncaa/500/9999999.png", "/league-basketball.png", "https://unrelated.example/i/teamlogos/ncaa/500/2724.png"]) assert.equal(ncaaSvgLogo(source), null);
});

test("ambiguous school names have explicit mappings rather than fuzzy identity matches", () => {
  assert.equal(NCAA_SVG_BY_ESPN_ID["232"], "col-of-charleston");
  assert.equal(NCAA_SVG_BY_ESPN_ID["2390"], "miami-fl");
  assert.equal(NCAA_SVG_BY_ESPN_ID["161"], "fdu");
  assert.equal(NCAA_SVG_BY_ESPN_ID["2900"], "st-thomas-mn");
});

test("East Texas A&M uses the NCAA asset retained under its former Commerce name", () => {
  assert.equal(ncaaSvgLogo("https://a.espncdn.com/i/teamlogos/ncaa/500/2837.png"), "https://www.ncaa.com/sites/default/files/images/logos/schools/bgl/tex-am-commerce.svg");
});
