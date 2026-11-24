import type { Game, SideBetMarketQuote } from "./types";

/**
 * The Action Network market adapter can return a priced but incorrect
 * basketball spread. Compare pregame quotes with ESPN's explicitly identified
 * DraftKings market before allowing them onto the board or into snapshots.
 * When no independent quote exists, fail closed on conspicuous anomalies.
 */
export function verifyBasketballPregameMarket(
  game: Game,
  action: SideBetMarketQuote | null,
  espn: SideBetMarketQuote | null
): SideBetMarketQuote | null {
  if (!action) return espn;
  if (action.phase !== "pregame") return action;

  const verified = espn?.phase === "pregame" && espn.spread && !espn.spread.suspended
    ? espn.spread : null;
  const quoted = action.spread && !action.spread.suspended ? action.spread : null;

  // The direct ESPN/DraftKings quote is an independent identity-checked source.
  // Normal movement (under 4 points) stays with the more timely Action quote.
  if (verified && (!quoted || Math.abs(quoted.awayPoint - verified.awayPoint) >= 4)) {
    return { ...action, spread: verified };
  }
  if (!quoted || verified) return action;

  const stored = Number(game.current_spread);
  const storedAway = game.current_spread != null && Number.isFinite(stored)
    ? game.current_spread_team === game.away_team ? stored
      : game.current_spread_team === game.home_team ? -stored : null
    : null;

  // A large, uncorroborated change must not replace a previously saved line.
  const changedFar = storedAway != null && Math.abs(quoted.awayPoint - storedAway) > 6;
  // Thirty-point Division I games are possible, but require corroboration.
  // Otherwise withholding the spread is safer than accepting a bad 38.5.
  const unusuallyLarge = game.league === "CBB" && Math.abs(quoted.awayPoint) >= 27;
  const moneyline = espn?.moneyline && !espn.moneyline.suspended ? espn.moneyline : action.moneyline;
  const extremeMoneyline = moneyline && !moneyline.suspended && (
    (moneyline.awayOdds <= -700 && moneyline.homeOdds >= 400) ||
    (moneyline.homeOdds <= -700 && moneyline.awayOdds >= 400)
  );
  // A near-pick'em spread cannot belong to an overwhelming ML favorite.
  const implausibleMoneyline = Boolean(extremeMoneyline && Math.abs(quoted.awayPoint) <= 5);

  if (changedFar || unusuallyLarge || implausibleMoneyline) {
    return { ...action, spread: null };
  }
  return action;
}
