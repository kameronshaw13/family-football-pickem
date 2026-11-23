import type { Game, SideBet } from "./types.ts";
import { isPostponedGame } from "./gameBoardStatus.ts";

/**
 * Read-only live state used by the score refresh coordinator.
 * Network polling, offer expiry mutations and saved bet terms remain
 * authoritative in the existing app/server paths.
 */
export function hasRecentlyStartedGames(games: Game[] | null | undefined, clock: number) {
  return Boolean(games?.some(game => {
    const start = new Date(game.commence_time).getTime();
    return game.final_home_score == null &&
      game.final_away_score == null &&
      !game.live_completed &&
      !isPostponedGame(game) &&
      start <= clock &&
      start >= clock - 18 * 60 * 60 * 1000;
  }));
}

export function changedLiveOfferScores(bets: SideBet[], games: Game[]) {
  const gamesById = new Map(games.map(game => [game.id, game]));
  return bets.flatMap(bet => {
    if (bet.status !== "open" || bet.offer_phase !== "live") return [];
    const sentHome = bet.live_offer_home_score == null ? null : Number(bet.live_offer_home_score);
    const sentAway = bet.live_offer_away_score == null ? null : Number(bet.live_offer_away_score);
    const game = gamesById.get(bet.game_id);
    const visibleHome = game?.live_home_score == null ? null : Number(game.live_home_score);
    const visibleAway = game?.live_away_score == null ? null : Number(game.live_away_score);
    if (sentHome == null || sentAway == null || visibleHome == null || visibleAway == null) return [];
    if (sentHome === visibleHome && sentAway === visibleAway) return [];
    return [{
      sideBetId: bet.id,
      visibleLiveHomeScore: visibleHome,
      visibleLiveAwayScore: visibleAway
    }];
  });
}
