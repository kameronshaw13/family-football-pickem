import test from "node:test";
import assert from "node:assert/strict";
import {
  collegeDirectoryUrls, matchHistoricCollegeDirectory,
  historicCollegeCandidates, historicLogoImageFromDetail
} from "../lib/collegeVintageLogos.ts";

test("historical archive matches Wichita State and never a similarly named school", () => {
  const html = '<a href="/logos/list_by_team/911/Wichita-State-Shockers-Logos/">Wichita State Shockers</a>'
    + '<a href="/logos/list_by_team/1021/Washington-State-Cougars-Logos/">Washington State Cougars</a>';
  assert.equal(matchHistoricCollegeDirectory(html, "Wichita State Shockers")?.teamId, "911");
  assert.equal(matchHistoricCollegeDirectory(html, "Wichita Warriors"), null);
});

test("historical artwork honors exact team identity across same-mascot schools", () => {
  const html = '<a href="/logos/view/91174901972/Wichita-State-Shockers-Logo/1964/Primary-Logo">1964</a>'
    + '<a href="/logos/view/102174901972/Washington-State-Cougars-Logo/1964/Primary-Logo">1964</a>';
  const logos = historicCollegeCandidates(html, "911", "Wichita State Shockers");
  assert.equal(logos.length, 1);
  assert.equal(logos[0].year, 1964);
  assert.equal(logos[0].kind, "Primary");
  assert.ok(logos[0].url.includes("91174901972"));
});

test("historical detail images require matching verified team ID", () => {
  const html = '<img src="https://content.sportslogos.net/logos/35/1021/full/wrong_team_1964.png">'
    + '<img src="https://content.sportslogos.net/logos/35/911/full/wichita_state_shockers_logo_primary_1964sportslogosnet4374.png">';
  assert.equal(historicLogoImageFromDetail(html, "911", 1964),
    "https://content.sportslogos.net/logos/35/911/full/wichita_state_shockers_logo_primary_1964sportslogosnet4374.png");
});

test("UC Riverside school aliases include the historical California section", () => {
  const urls = collegeDirectoryUrls("UC Riverside Highlanders");
  assert.equal(urls.length, 2);
  assert.ok(urls[0].includes("/35/"));
  assert.ok(urls[1].includes("/30/"));
  const html = '<a href="/logos/list_by_team/881/California-Riverside-Highlanders-Logos/">UC Riverside</a>';
  assert.equal(matchHistoricCollegeDirectory(html, "UC Riverside Highlanders")?.teamId, "881");
});
