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

function restoreStateDisplay(team: string, displayName: string) {
  // The base school-name cleanup historically shortened every "State" to "St.".
  // Only reverse that styling when the actual incoming college team contains the
  // word State, so legitimate Saint/St. school names remain untouched.
  if (!/\bstate\b/i.test(team)) return displayName;
  return displayName.replace(/\bSt\.(?=\s|$)/g, "State");
}

export function teamDisplayName(league: string | null | undefined, team: string) {
  if (league !== "NFL") {
    const override = DISPLAY_OVERRIDES[normalizeTeamNameKey(team)];
    if (override) return override;
  }
  const displayName = baseTeamDisplayName(league, team);
  return league === "NFL" ? displayName : restoreStateDisplay(team, displayName);
}

export function teamAbbreviatedName(league: string | null | undefined, team: string) {
  return baseTeamAbbreviatedName(league, team);
}
