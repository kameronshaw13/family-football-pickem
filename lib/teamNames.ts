import {
  normalizeTeamNameKey,
  teamAbbreviatedName as baseTeamAbbreviatedName,
  teamDisplayName as baseTeamDisplayName
} from "./teamNamesBase";

export { normalizeTeamNameKey };

declare global {
  // Injected by the root layout from ESPN's all-college-teams feed before the
  // client app hydrates. Keys use the same normalization rules as ESPN aliases.
  var __pickemEspnCollegeAbbreviations: Record<string, string> | undefined;
}

const DISPLAY_OVERRIDES: Record<string, string> = {
  "boston college": "Boston College",
  "boston college eagles": "Boston College"
};

function espnAbbreviationKey(value: string) {
  return normalizeTeamNameKey(value)
    .replace(/\bsan jos\b/g, "san jose")
    .replace(/\bst\b/g, "state")
    .replace(/\bmiami fl\b/g, "miami")
    .replace(/\bmiami florida\b/g, "miami")
    .replace(/\bmississippi\b/g, "miss");
}

function espnCollegeAbbreviation(team: string, displayName: string) {
  const aliases = globalThis.__pickemEspnCollegeAbbreviations;
  if (!aliases) return null;
  const raw = aliases[espnAbbreviationKey(team)];
  if (raw) return raw;
  return aliases[espnAbbreviationKey(displayName)] || null;
}

export function teamDisplayName(league: string | null | undefined, team: string) {
  if (league !== "NFL") {
    const override = DISPLAY_OVERRIDES[normalizeTeamNameKey(team)];
    if (override) return override;
  }
  return baseTeamDisplayName(league, team);
}

export function teamAbbreviatedName(league: string | null | undefined, team: string) {
  const displayName = teamDisplayName(league, team);
  if (league !== "NFL") {
    const espn = espnCollegeAbbreviation(team, displayName);
    if (espn) return espn;
  }
  return baseTeamAbbreviatedName(league, team);
}
