import type { Game, SideBetMarketQuote } from "./types.ts";
import { normalizeVerifiedMarketSpread } from "./marketSpread.ts";
import { normalizeSpreadForSelectedTeam } from "./spreads.ts";
import { canRefreshSpread } from "./lockRules.ts";
import { basketballLockTime, isBasketballLeague } from "./basketballRules.ts";

export type BoardScheduleUpdate = Pick<Game, "id" | "commence_time" | "neutral_site" | "event_status" | "lock_time" | "is_locked">;

/** Keep this read-only: market updates must never mutate saved pick terms. */
export function hasNewBoardScheduleGames(games: Game[], schedule: BoardScheduleUpdate[]) {
  const currentIds = new Set(games.map(game => game.id));
  return schedule.some(game => !currentIds.has(game.id));
}

/**
 * Reconcile refreshed board display data while preserving all other game state.
 * Returns the original array if nothing changed to avoid redundant renders.
 */
export function reconcileBoardMarketGames(
  games: Game[],
  markets: SideBetMarketQuote[],
  schedule: BoardScheduleUpdate[],
  now: Date
): Game[] {
  const quotesById = new Map(markets.map(quote => [quote.gameId, quote]));
  const scheduleById = new Map(schedule.map(game => [game.id, game]));
  let changed = false;
  const nextGames = games.map(game => {
    const scheduleGame = scheduleById.get(game.id);
    let nextGame = game;
    if (scheduleGame && (
      scheduleGame.commence_time !== game.commence_time ||
      scheduleGame.neutral_site !== Boolean(game.neutral_site) ||
      scheduleGame.event_status !== (game.event_status || null) ||
      scheduleGame.lock_time !== game.lock_time ||
      scheduleGame.is_locked !== game.is_locked
    )) {
      changed = true;
      nextGame = { ...game, ...scheduleGame };
    }

    const quote = quotesById.get(game.id);
    const spread = quote?.phase === "pregame" && quote.spread && !quote.spread.suspended
      ? normalizeVerifiedMarketSpread(nextGame.league, quote.spread, quote.moneyline) : null;
    if (!spread || !(isBasketballLeague(nextGame.league)
      ? now < basketballLockTime(nextGame.commence_time)
      : canRefreshSpread(nextGame.commence_time, now))) return nextGame;
    const nextAwaySpread = Number(spread.awayPoint);
    const currentAwaySpread = normalizeSpreadForSelectedTeam(
      nextGame.away_team, nextGame.current_spread_team, nextGame.current_spread
    );
    if (!Number.isFinite(nextAwaySpread)) return nextGame;
    const spreadUnchanged = currentAwaySpread != null && Math.abs(currentAwaySpread - nextAwaySpread) < 0.001;
    if (spreadUnchanged && nextGame.current_bookmaker === "DraftKings") return nextGame;
    changed = true;
    return {
      ...nextGame,
      current_spread_team: nextGame.away_team,
      current_spread: nextAwaySpread,
      current_bookmaker: "DraftKings",
      updated_at: now.toISOString()
    };
  });
  return changed ? nextGames : games;
}
