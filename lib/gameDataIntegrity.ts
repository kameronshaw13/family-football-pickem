import { normalizeTeamNameKey, teamDisplayName } from "./teamNames.ts";

export function footballTeamIdentity(name: string) {
  const key = normalizeTeamNameKey(teamDisplayName("CFB", name));
  return key === "app state" ? "appalachian state" : key;
}

type GameData = {
  id: string;
  home_team: string;
  away_team: string;
  updated_at?: string | null;
  current_bookmaker?: string | null;
  current_spread: number | string | null;
  current_spread_team: string | null;
  spread_source_updated_at?: string | null;
  score_source_updated_at?: string | null;
  final_home_score: number | null;
  final_away_score: number | null;
};

export function hasValidGameLine(game: GameData) {
  const team = footballTeamIdentity(game.current_spread_team || "");
  return game.current_spread != null && String(game.current_spread).trim() !== "" && Number.isFinite(Number(game.current_spread)) &&
    !!team && [game.home_team, game.away_team].some(name => footballTeamIdentity(name) === team);
}

function timestamp(value: string | null | undefined) { return Date.parse(value || "") || 0; }
function linePriority(game: GameData) {
  const source = game.current_bookmaker || "";
  return /manual|override/i.test(source) ? 3 : /draft\s*kings/i.test(source) ? 2 : 1;
}

/** Select display data without changing the game identity or saved wager terms. */
export function selectGameLine<T extends GameData>(a: T, b: T): T | null {
  const valid = [a, b].filter(hasValidGameLine);
  return valid.sort((x, y) => linePriority(y) - linePriority(x) ||
    timestamp(y.spread_source_updated_at || y.updated_at) - timestamp(x.spread_source_updated_at || x.updated_at) || x.id.localeCompare(y.id))[0] || null;
}

export function selectGameFinal<T extends GameData>(a: T, b: T): T | null {
  // Keep the home/away pair from one complete source. Nulls are not zeroes.
  return [a, b].filter(game => [game.final_home_score, game.final_away_score].every(score => score != null && Number.isInteger(score) && score >= 0))
    .sort((x, y) => timestamp(y.score_source_updated_at || y.updated_at) - timestamp(x.score_source_updated_at || x.updated_at) || x.id.localeCompare(y.id))[0] || null;
}
