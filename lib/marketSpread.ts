import type { League } from "./types";

/** A validated, two-sided market line; a missing price is not proof of a PK. */
export type TwoWaySpread = {
  awayPoint: number;
  homePoint: number;
  awayOdds: number | null;
  homeOdds: number | null;
  suspended: boolean;
};

/**
 * A priced zero is PK. A nominal +/-1.5 line paired with
 * near-even moneylines is also treated as PK: both prices must be between
 * -115 and even money, and no more than 10 cents apart. +100 and -100
 * are equivalent. -115/-105 qualifies; -120/+100 does not. Only NFL uses the moneyline favorite for -0.5; other leagues always
 * use home -0.5/away +0.5. Equal NFL moneylines also default home.
 * Missing moneylines never turn a nonzero spread into a pick'em.
 */
export function normalizeVerifiedMarketSpread(league: League, market: TwoWaySpread | null, moneyline?: { awayOdds: number; homeOdds: number; suspended?: boolean } | null): TwoWaySpread | null {
  if (!market) return null;
  const { awayPoint, homePoint, awayOdds, homeOdds } = market;
  const evenPrice = (odds: number) => odds === 100 ? -100 : odds;
  const pickem = () => {
    const validMoneyline = moneyline && !moneyline.suspended && [moneyline.awayOdds, moneyline.homeOdds].every(price => Number.isInteger(price) && Math.abs(price) >= 100);
    const awayFavorite = league === "NFL" && validMoneyline && evenPrice(moneyline.awayOdds) < evenPrice(moneyline.homeOdds);
    const awayPoint = awayFavorite ? -0.5 : 0.5;
    return { ...market, awayPoint, homePoint: -awayPoint };
  };
  if (!Number.isFinite(awayPoint) || !Number.isFinite(homePoint) || Math.abs(awayPoint + homePoint) > 0.001) return null;
  if (awayPoint === 0 && homePoint === 0) {
    const validPrice = (price: number | null) => price != null && Number.isInteger(price) && Math.abs(price) >= 100;
    if (!validPrice(awayOdds) || !validPrice(homeOdds)) return null;
    return pickem();
  }
  if (Math.abs(awayPoint) === 1.5 && moneyline && !moneyline.suspended) {
    const away = evenPrice(moneyline.awayOdds), home = evenPrice(moneyline.homeOdds);
    if ([away, home].every(price => Number.isInteger(price) && price >= -115 && price <= -100) && Math.abs(away - home) <= 10) {
      return pickem();
    }
  }
  return market;
}

/** Stored zeroes must be revalidated and converted before becoming pick lines. */
export function hasUsableStoredGameSpread(game: {
  league?: string;
  current_spread_team: string | null;
  current_spread: number | string | null;
}) {
  const spread = game.current_spread;
  return Boolean(game.current_spread_team) &&
    spread != null && String(spread).trim() !== "" && Number.isFinite(Number(spread)) &&
    Number(spread) !== 0;
}

/** Historical recovery requires explicit, priced closing lines on both sides.
 * Never infer a closing spread from a moneyline, winner or missing value. */
export function verifiedClosingSpread(league: League, row: any) {
  if (!/^draftkings$/i.test(row?.provider?.name || "")) return null;
  const number = (value: unknown) => value == null || String(value).trim() === "" ? NaN : Number(value);
  const awayPoint = number(row.pointSpread?.away?.close?.line);
  const homePoint = number(row.pointSpread?.home?.close?.line);
  const awayOdds = number(row.pointSpread?.away?.close?.odds);
  const homeOdds = number(row.pointSpread?.home?.close?.odds);
  if (![awayOdds, homeOdds].every(value => Number.isInteger(value) && Math.abs(value) >= 100)) return null;
  return normalizeVerifiedMarketSpread(league, { awayPoint, homePoint, awayOdds, homeOdds, suspended: false }, {
    awayOdds: number(row.moneyline?.away?.close?.odds ?? row.awayTeamOdds?.moneyLine),
    homeOdds: number(row.moneyline?.home?.close?.odds ?? row.homeTeamOdds?.moneyLine)
  });
}
