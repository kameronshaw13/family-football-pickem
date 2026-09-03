import assert from "node:assert/strict";
import test from "node:test";
import { isFbsTeamGame } from "../lib/cfbConferences.ts";

test("stale Northern Iowa versus Eastern Washington row is excluded even with incorrect FBS logos", () => {
  assert.equal(isFbsTeamGame({
    league: "CFB",
    away_team: "Northern Iowa Panthers",
    home_team: "Eastern Washington Eagles",
    away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/2294.png",
    home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/2459.png"
  }), false);
});

test("Northern Iowa remains eligible when it actually plays an FBS team", () => {
  assert.equal(isFbsTeamGame({
    league: "CFB",
    away_team: "Northern Iowa Panthers",
    home_team: "Iowa Hawkeyes",
    away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/2460.png",
    home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/2294.png"
  }), true);
});
