import { normalizeTeamNameKey } from "./teamNames.ts";

/** ESPN summary and scoreboard can disagree about home/away at neutral sites. */
export function basketballSummarySwapped(game: { home_team: string; away_team: string }, home: any, away: any) {
  const name = (row: any) => normalizeTeamNameKey(String(row?.team?.displayName || ""));
  const savedHome = normalizeTeamNameKey(game.home_team);
  const savedAway = normalizeTeamNameKey(game.away_team);
  const direct = name(home) === savedHome && name(away) === savedAway;
  const swapped = name(home) === savedAway && name(away) === savedHome;
  return swapped && !direct;
}

export function orientBasketballPlayScores<T extends { homeScore?: unknown; awayScore?: unknown }>(play: T, swapped: boolean): T {
  return swapped ? { ...play, homeScore: play.awayScore, awayScore: play.homeScore } : play;
}
