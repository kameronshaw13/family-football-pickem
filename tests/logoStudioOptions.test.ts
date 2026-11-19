import test from "node:test";
import assert from "node:assert/strict";
import { parseHistoricalLogos, findArchivedTeam } from "../lib/logoHistoryParser.ts";
import { logoKeyFromSource } from "../lib/logoStudio.ts";
import { curatedLogoAlternatives } from "../lib/logoExtraOptions.ts";
import { contentFingerprint } from "../lib/logoFingerprint.ts";

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

test("duplicate SVG designs collapse despite palette/colorway changes", () => {
  const encode = (s: string) => new TextEncoder().encode(s);
  const navy = encode('<svg viewBox="0 0 100 100"><path d="M 0,0 L 60,90" fill="#003b66"/><circle cx="25" cy="25" r="6" stroke="red"/></svg>');
  const gold = encode('<svg viewBox="0 0 100 100"><path fill="gold" d="M 0 0 L 60 90"/><circle r="6" cx="25" cy="25" stroke="blue"/></svg>');
  const other = encode('<svg viewBox="0 0 100 100"><path d="M 0 0 L 65 90"/></svg>');
  assert.equal(contentFingerprint(navy, "image/svg+xml"), contentFingerprint(gold, "image/svg+xml"));
  assert.notEqual(contentFingerprint(navy, "image/svg+xml"), contentFingerprint(other, "image/svg+xml"));
});

test("recommended Modern logo source favors NBA CDN and NCAA school files", async () => {
  const { recommendedModernLogo, draftRecommendedModernLogos } = await import("../lib/logoRecommendation.ts");
  const nba = { league: "NBA", name: "LA Clippers", key: "cbs:344", logo: "https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/lac.png" };
  const college = { league: "College", name: "Wichita State", key: "ncaa:2724", logo: "https://a.espncdn.com/i/teamlogos/ncaa/500/2724.png" };
  const nfl = { league: "NFL", name: "Kansas City Chiefs", key: "cbs:12", logo: "https://a.espncdn.com/i/teamlogos/nfl/500/12.png" };
  assert.ok(recommendedModernLogo(nba)?.url.startsWith("https://cdn.nba.com/"));
  assert.ok(recommendedModernLogo(college)?.url.startsWith("https://www.ncaa.com/"));
  assert.equal(recommendedModernLogo(nfl)?.url, nfl.logo);
  const draft = draftRecommendedModernLogos([nba, college, nfl], { [nba.key]: { modern: "https://example.com/custom.svg" }, [college.key]: { vintage: "https://example.com/old.svg" } }, {});
  assert.equal(draft.added, 2);
  assert.equal(draft.choices[nba.key].modern, "https://example.com/custom.svg");
  assert.equal(draft.choices[college.key].vintage, "https://example.com/old.svg");
  assert.equal(draft.choices[college.key].modern, recommendedModernLogo(college)?.url);
  assert.equal(draft.choices[nfl.key].modern, nfl.logo);
  assert.equal(draftRecommendedModernLogos([nba], {}, { [nba.key]: "https://example.com/published.svg" }).added, 0);
});

test("athletics-site sourced logos map to the correct school and never claim an unknown team", async () => {
  const { verifiedSchoolLogo, countVerifiedSchoolLogos } = await import("../lib/verifiedSchoolLogos.ts");
  assert.ok(countVerifiedSchoolLogos() >= 150);
  const source = verifiedSchoolLogo("https://a.espncdn.com/i/teamlogos/ncaa/500/2724.png");
  assert.equal(source?.sourcePage, "https://goshockers.com/");
  assert.ok(source?.url.startsWith("https://"));
  assert.equal(verifiedSchoolLogo("https://a.espncdn.com/i/teamlogos/ncaa/500/99999999.png"), null);
});
