import type { Game } from "./types.ts";
import { isFinalGame } from "./gameBoardStatus.ts";

/**
 * Single owner for the Pick Board game slate.
 *
 * Keeps filters display-only: selecting a league or conference must never
 * alter picks, saved spreads, lock state, or odds updates.
 * Sport-specific conference checks are passed in as pure predicates so this
 * module remains usable by both football/basketball without importing React.
 */
export function filterBoardGames({
  games, active, basketball, leagueFilter, conferenceFilter, cbbConferenceFilter,
  dogValueFilter, matchesFootballConference, matchesBasketballConference, dogValueForTeam
}: {
  games: Game[];
  active: boolean;
  basketball: boolean;
  leagueFilter: "ALL" | "CFB" | "NFL" | "CBB" | "NBA" | "DOGS";
  conferenceFilter: string;
  cbbConferenceFilter: string;
  dogValueFilter: "ALL" | "1" | "2" | "3";
  matchesFootballConference: (game: Game) => boolean;
  matchesBasketballConference: (game: Game) => boolean;
  dogValueForTeam: (game: Game, team: string) => number;
}): Game[] {
  if (!active) return [];
  const replacementEventIds = new Set(games
    .filter(game => game.event_status !== "STATUS_RESCHEDULED" && game.espn_event_id)
    .map(game => `${game.league}:${game.espn_event_id}`));
  const finalMatchups = new Set<string>();
  return games.filter(game => {
    if (game.event_status === "STATUS_RESCHEDULED" && game.espn_event_id &&
        replacementEventIds.has(`${game.league}:${game.espn_event_id}`)) return false;
    if (leagueFilter === "ALL") {
      if (basketball) {
        return game.league === "CBB" ? matchesBasketballConference(game)
          : game.league === "NBA" && cbbConferenceFilter === "ALL";
      }
      return game.league === "CFB" ? matchesFootballConference(game)
        : game.league === "NFL" && conferenceFilter === "ALL";
    }
    if (leagueFilter === "CFB") return game.league === "CFB" && matchesFootballConference(game);
    if (leagueFilter === "CBB") return game.league === "CBB" && matchesBasketballConference(game);
    if (leagueFilter === "NFL" || leagueFilter === "NBA") return game.league === leagueFilter;
    const dogValue = Math.max(...[game.away_team, game.home_team].map(team => dogValueForTeam(game, team)));
    return dogValue > 0 && (dogValueFilter === "ALL" || dogValue === Number(dogValueFilter));
  }).sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime())
    .filter(game => {
      if (!isFinalGame(game)) return true;
      const key = [game.league, game.week, game.commence_time, game.away_team, game.home_team].join("|");
      if (finalMatchups.has(key)) return false;
      finalMatchups.add(key);
      return true;
    });
}
