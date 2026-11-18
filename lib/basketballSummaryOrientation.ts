import { basketballDateChanged } from "./basketballRules.ts";
import { verifiedClosingSpread } from "./marketSpread.ts";
import type { Game } from "./types.ts";
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

/** Confirm the completed event and return the closing line in saved team order. */
export function basketballClosingHomeSpread(game: Game, summary: any): number | null {
  const competition = summary.header?.competitions?.[0];
  if (!game.espn_event_id || String(summary.header?.id) !== game.espn_event_id
    || !competition?.status?.type?.completed || !competition.date
    || basketballDateChanged(game.commence_time, competition.date)) return null;

  const providerHome = competition.competitors?.find((row: any) => row.homeAway === "home");
  const providerAway = competition.competitors?.find((row: any) => row.homeAway === "away");
  const swapped = basketballSummarySwapped(game, providerHome, providerAway);
  const home = swapped ? providerAway : providerHome;
  const away = swapped ? providerHome : providerAway;
  if (!home?.team?.displayName || !away?.team?.displayName
    || normalizeTeamNameKey(home.team.displayName) !== normalizeTeamNameKey(game.home_team)
    || normalizeTeamNameKey(away.team.displayName) !== normalizeTeamNameKey(game.away_team)) return null;

  const closing = (Array.isArray(summary.pickcenter) ? summary.pickcenter : [])
    .map((row: unknown) => verifiedClosingSpread(game.league, row)).find(Boolean);
  return closing ? (swapped ? closing.awayPoint : closing.homePoint) : null;
}
