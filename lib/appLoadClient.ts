import type { Game } from "./types.ts";
import { retainBasketballSpread } from "./gameDataIntegrity.ts";

/** Select a warmed initial payload without accidentally loading another week. */
export function selectInitialAppCache<T extends { week: number }>(
  initial: boolean,
  selectedWeek: number | null,
  read: (week: number | null) => T | null
): T | null {
  if (!initial) return null;
  const exact = read(selectedWeek);
  if (exact) return exact;
  if (selectedWeek == null) return null;
  const warmedDefault = read(null);
  return warmedDefault?.week === selectedWeek ? warmedDefault : null;
}

/** Preserve the established three-attempt network retry and linear backoff.
 * HTTP error responses are returned immediately for the app's own handling.
 */
export async function fetchAppDataWithRetry(
  url: string,
  init: RequestInit,
  fetcher: (url: string, init: RequestInit) => Promise<Response> = fetch,
  pause: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))
): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fetcher(url, init);
    } catch (error) {
      lastError = error;
      if (attempt < 2) await pause(250 * (attempt + 1));
    }
  }
  throw lastError || new Error("Could not load app data.");
}

/** Retain validated basketball quotes only during a same-week refresh. */
export function retainReloadedBasketballLines<T extends { week: number; games: Game[] }>(
  payload: T,
  previous: T | null
): T {
  if (!previous || previous.week !== payload.week) return payload;
  const previousGames = new Map(previous.games.map(game => [game.id, game]));
  return {
    ...payload,
    games: payload.games.map(game => retainBasketballSpread(game, previousGames.get(game.id)))
  };
}
