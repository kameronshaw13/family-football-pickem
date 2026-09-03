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
  "jacksonville state": "Jax. State",
  "jacksonville state gamecocks": "Jax. State",
  "jsu": "Jax. State"
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
