import {
  normalizeTeamNameKey,
  teamAbbreviatedName as baseTeamAbbreviatedName,
  teamDisplayName as baseTeamDisplayName
} from "./teamNamesBase";

export { normalizeTeamNameKey };

const DISPLAY_OVERRIDES: Record<string, string> = {
  "boston college": "Boston College",
  "boston college eagles": "Boston College"
};

const ABBREVIATION_OVERRIDES: Record<string, string> = {
  "air force": "AFA",
  "alabama": "Bama",
  "arkansas state": "Ark. St.",
  "arkansas st": "Ark. St.",
  "boise state": "Boise St.",
  "boise st": "Boise St.",
  "bowling green": "BGSU",
  "california": "Cal",
  "charlotte": "CLT",
  "cincinnati": "Cincy",
  "coastal carolina": "CCU",
  "colorado": "CU",
  "east carolina": "ECU",
  "fresno state": "Fres. St.",
  "fresno st": "Fres. St.",
  "georgia": "UGA",
  "jacksonville state": "Jax. State",
  "jacksonville st": "Jax. State",
  "jacksonville state gamecocks": "Jax. State",
  "jsu": "Jax. State",
  "james madison": "JMU",
  "kansas": "KU",
  "kennesaw state": "Kenn. St.",
  "kennesaw st": "Kenn. St.",
  "kentucky": "UK",
  "louisiana tech": "La Tech",
  "mississippi state": "Miss. St.",
  "mississippi st": "Miss. St.",
  "new mexico": "NMU",
  "north carolina": "UNC",
  "north texas": "UNT",
  "northwestern": "NWU",
  "oklahoma": "OU",
  "old dominion": "ODU",
  "pittsburgh": "Pitt",
  "sam houston": "SHSU",
  "sam houston state": "SHSU",
  "south alabama": "USA",
  "south carolina": "South Car.",
  "south florida": "USF",
  "southern miss": "USM",
  "southern mississippi": "USM",
  "tennessee": "Tenn",
  "texas aandm": "TA&M",
  "texas tech": "TTU",
  "vanderbilt": "Vandy",
  "west virginia": "WVU",
  "west virginia mountaineers": "WVU"
};

export function teamDisplayName(league: string | null | undefined, team: string) {
  if (league !== "NFL") {
    const override = DISPLAY_OVERRIDES[normalizeTeamNameKey(team)];
    if (override) return override;
  }
  return baseTeamDisplayName(league, team);
}

export function teamAbbreviatedName(league: string | null | undefined, team: string) {
  if (league !== "NFL") {
    const rawKey = normalizeTeamNameKey(team);
    const displayKey = normalizeTeamNameKey(teamDisplayName(league, team));
    const override = ABBREVIATION_OVERRIDES[rawKey] || ABBREVIATION_OVERRIDES[displayKey];
    if (override) return override;
  }
  return baseTeamAbbreviatedName(league, team);
}
