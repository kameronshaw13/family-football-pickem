import test from "node:test";
import assert from "node:assert/strict";
import { vintageSchoolSlugs, parseCollegeHistoryHtml } from "../lib/collegeVintageLogos.ts";
import { collegeHistoricalImageSource, isCollegeHistoricalImage } from "../lib/collegeLogoImage.ts";

const wichita = [
  "<h1>Wichita State Shockers Logo History – Primary Logo</h1>",
  '<img src="https://sportslogohistory.com/wp-content/uploads/2022/08/wichita_state_shockers_2011-pres.png" alt="Wichita State Shockers Primary Logo 2011 - Present">',
  '<img src="https://sportslogohistory.com/wp-content/uploads/2022/08/wichita_state_shockers_1959-1964.png" alt="Wichita State Shockers Primary Logo 1959 - 1964">',
  '<img src="https://sportslogohistory.com/wp-content/uploads/2022/08/wichita_state_shockers_1948-1959.png" alt="Wichita State Shockers Primary Logo 1948 - 1959">',
  '<img src="https://sportslogohistory.com/wp-content/uploads/2022/08/notre_dame_fighting_irish_1948.png" alt="Notre Dame Fighting Irish Primary Logo 1948 - 1959">',
  '<img src="https://sportslogohistory.com/wp-content/uploads/2021/03/Sports-Logo-History-350-1.png" alt="Sports Logo History">'
].join("\n");

test("parse real school-labelled historical images and exclude other teams and site ads", () => {
  const found = parseCollegeHistoryHtml(wichita, "Wichita State Shockers", "Primary");
  assert.deepEqual(found.map(x=>x.year), [1948, 1959, 2011]);
  assert.ok(found.every(x=>x.url.includes("wichita_state_shockers")));
  assert.deepEqual(parseCollegeHistoryHtml(wichita, "Notre Dame Fighting Irish", "Primary"), []);
});

test("do not confuse different logo types or unrelated school pages", () => {
  const html = "<h1>UC Riverside Highlanders Logo History – Primary Logo</h1>"
    + '<img src="https://sportslogohistory.com/wp-content/uploads/2019/03/uc_riverside_highlanders_2003-2011.png" alt="UC Riverside Highlanders Primary Logo 2003 - 2011">'
    + '<img src="https://sportslogohistory.com/wp-content/uploads/2019/03/uc_riverside_highlanders_2003-alt.png" alt="UC Riverside Highlanders Alternate Logo 2003 - 2011">';
  assert.equal(parseCollegeHistoryHtml(html, "UC Riverside Highlanders", "Primary").length, 1);
  assert.equal(parseCollegeHistoryHtml(html, "UC Riverside Highlanders", "Alternate").length, 1);
  assert.equal(parseCollegeHistoryHtml(html, "California Riverside Highlanders", "Primary").length, 0);
});

test("vintage slug lookup covers explicit school aliases without fuzzy collisions", () => {
  assert.deepEqual(vintageSchoolSlugs("Wichita State Shockers"), ["wichita-state-shockers"]);
  assert.ok(vintageSchoolSlugs("East Texas A&M Lions").includes("texas-am-commerce-lions"));
  assert.ok(vintageSchoolSlugs("UC Riverside Highlanders").includes("california-riverside-highlanders"));
  assert.ok(vintageSchoolSlugs("UTSA Roadrunners").includes("texas-san-antonio-roadrunners"));
  assert.ok(!vintageSchoolSlugs("UC Riverside Highlanders").includes("uc-irvine-anteaters"));
});

test("only historical college art is proxied; NBA and NFL sources stay unchanged", () => {
  const college = "https://sportslogohistory.com/wp-content/uploads/2022/08/wichita_state_shockers_1948-1959.png";
  const nfl = "https://sports.cbsimg.net/fly/images/team-logos/421.svg";
  const proHistory = "https://content.sportslogos.net/logos/6/237/full/anything.png";
  assert.equal(isCollegeHistoricalImage(college), true);
  assert.ok(collegeHistoricalImageSource(college).startsWith("/api/college-logo-image?src="));
  assert.equal(collegeHistoricalImageSource(nfl), nfl);
  assert.equal(collegeHistoricalImageSource(proHistory), proHistory);
  assert.equal(isCollegeHistoricalImage("https://evil.example/wp-content/uploads/2022/08/unknown.png"), false);
});


test("historical former-name art stays attached to the renamed East Texas A&M school", () => {
  const html = '<h1>East Texas A&M Lions Logo History – Primary Logo</h1>'
    + '<img src="https://sportslogohistory.com/wp-content/uploads/2022/09/texas_am_commerce_lions_1968-1996.png" alt="Texas A&M Commerce Lions Primary Logo 1968 - 1996">';
  const found = parseCollegeHistoryHtml(html, "East Texas A&M Lions", "Primary");
  assert.equal(found.length, 1);
  assert.equal(found[0].year, 1968);
  assert.ok(vintageSchoolSlugs("East Texas A&M Lions").includes("east-texas-am-lions"));
});
