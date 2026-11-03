import type { League } from "./types";

/** A validated, two-sided market line; a missing price is not proof of a PK. */
export type TwoWaySpread = {
  awayPoint: number;
  homePoint: number;
  awayOdds: number | null;
  homeOdds: number | null;
  suspended: boolean;
};

function basketball(league: string) {
  return league === "CBB" || league === "NBA";
}

/**
 * Preserve published nonzero spreads. Only a genuine, priced 0/0 market counts
 * as pick'em. Basketball cannot tie, so store PK as away +0.5 / home -0.5.
 * No price on either side means "No Line", not a free pick.
 */
export function normalizeVerifiedMarketSpread(league: League, market: TwoWaySpread | null): TwoWaySpread | null {
  if (!market) return null;
  const { awayPoint, homePoint, awayOdds, homeOdds } = market;
  if (!Number.isFinite(awayPoint) || !Number.isFinite(homePoint) || Math.abs(awayPoint + homePoint) > 0.001) return null;
  if (awayPoint === 0 && homePoint === 0) {
    const validPrice = (price: number | null) => price != null && Number.isInteger(price) && Math.abs(price) >= 100;
    if (!validPrice(awayOdds) || !validPrice(homeOdds)) return null;
    return basketball(league) ? { ...market, awayPoint: 0.5, homePoint: -0.5 } : market;
  }
  return market;
}

/** Legacy unpriced basketball zeroes must not appear as available pick lines. */
export function hasUsableStoredGameSpread(game: {
  league?: string;
  current_spread_team: string | null;
  current_spread: number | string | null;
}) {
  const spread = game.current_spread;
  return Boolean(game.current_spread_team) &&
    spread != null && String(spread).trim() !== "" && Number.isFinite(Number(spread)) &&
    !(basketball(game.league || "") && Number(spread) === 0);
}
