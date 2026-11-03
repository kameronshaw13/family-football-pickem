import { BASKETBALL_TEAM_LABELS } from "./basketballTeamNames.ts";
import {
  normalizeTeamNameKey,
  teamAbbreviatedName as baseTeamAbbreviatedName,
  teamDisplayName as baseTeamDisplayName
} from "./teamNamesBase.ts";

export { normalizeTeamNameKey };

const DISPLAY_OVERRIDES: Record<string, string> = {
  "boston college": "Boston College",
  "boston college eagles": "Boston College",
  "richmond spiders": "Richmond",
  "montana grizzlies": "Montana",
  "wagner seahawks": "Wagner",
  "gardner webb runnin bulldogs": "Gardner-Webb",
  "gardner webb running bulldogs": "Gardner-Webb",
  "gardner webb runnin": "Gardner-Webb",
  "gardner webb running": "Gardner-Webb",
  "no washington td": "No Washington TD"
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
  "kansas state": "K-State",
  "kansas st": "K-State",
  "kansas state wildcats": "K-State",
  "kennesaw state": "Kenn. St.",
  "kennesaw st": "Kenn. St.",
  "kentucky": "UK",
  "louisiana tech": "La Tech",
  "mississippi state": "Miss. St.",
  "mississippi st": "Miss. St.",
  "new mexico": "UNM",
  "north carolina": "UNC",
  "north texas": "UNT",
  "northwestern": "NU",
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
  "texas aandm": "TAMU",
  "texas tech": "TTU",
  "vanderbilt": "Vandy",
  "west virginia": "WVU",
  "west virginia mountaineers": "WVU",
  "no washington td": "No Washington TD"
};

// Index both provider names and school-only names so saved picks and fresh feeds
// resolve to the same labels. Unknown CBB teams still get college mascot cleanup.
const basketballLabels = Object.fromEntries(Object.entries(BASKETBALL_TEAM_LABELS).map(([league, labels]) => {
  const aliases = new Map<string, readonly [string, string]>();
  for (const [provider, label] of Object.entries(labels)) {
    aliases.set(provider, label);
    aliases.set(normalizeTeamNameKey(label[0]), label);
  }
  if (league === "CBB") {
    for (const name of ["Queens", "Queens Royals", "Queens University", "Queens University Royals", "Queens (NC)", "Queens (NC) Royals"]) {
      aliases.set(normalizeTeamNameKey(name), ["Queens", "QUC"]);
    }
  }
  return [league, aliases];
}));

function restoreStateDisplay(team: string, displayName: string) {
  if (!/\bstate\b/i.test(team)) return displayName;
  return displayName.replace(/\bSt\.(?=\s|$)/g, "State");
}

export function teamDisplayName(league: string | null | undefined, team: string) {
  if (league === "CBB" || league === "NBA") return basketballLabels[league].get(normalizeTeamNameKey(team))?.[0] ?? (league === "CBB" ? baseTeamDisplayName(league, team) : team);
  if (league !== "NFL") {
    const override = DISPLAY_OVERRIDES[normalizeTeamNameKey(team)];
    if (override) return override;
  }
  const displayName = baseTeamDisplayName(league, team);
  return league === "NFL" ? displayName : restoreStateDisplay(team, displayName);
}

export function teamAbbreviatedName(league: string | null | undefined, team: string) {
  if (league === "CBB" || league === "NBA") return basketballLabels[league].get(normalizeTeamNameKey(team))?.[1] ?? teamDisplayName(league, team);
  if (league !== "NFL") {
    const rawKey = normalizeTeamNameKey(team);
    const displayKey = normalizeTeamNameKey(teamDisplayName(league, team));
    const override = ABBREVIATION_OVERRIDES[rawKey] || ABBREVIATION_OVERRIDES[displayKey];
    if (override) return override;
  }
  return baseTeamAbbreviatedName(league, team);
}
