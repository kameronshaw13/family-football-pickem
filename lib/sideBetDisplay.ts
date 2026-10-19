import type { SideBet, SideBetTotalSide } from "./types.ts";
import { americanOddsText, oppositeAmericanOdds, oppositeTotalSide, type SideBetMarketType } from "./sideBetMarkets.ts";
import { spreadText } from "./spreads.ts";

/** Pure presentation helpers; no offer lifecycle or payout decisions. */
function totalSideText(side: SideBetTotalSide | null | undefined) {
  return side === "under" ? "U" : "O";
}

export function sideBetMarketText(
  marketType: SideBetMarketType | undefined,
  spread: number | null,
  odds: number,
  totalPoints?: number | null,
  totalSide?: SideBetTotalSide | null
) {
  const base = marketType === "moneyline"
    ? "ML"
    : marketType === "total"
      ? `${totalSideText(totalSide)} ${Number(totalPoints)}`
      : spreadText(spread);
  return odds === 100 ? base : `${base} ${americanOddsText(odds)}`;
}

export function sideBetOddsForTeam(bet: SideBet, team: string) {
  return team === bet.creator_team
    ? Number(bet.creator_odds ?? 100)
    : oppositeAmericanOdds(Number(bet.creator_odds ?? 100));
}

export function sideBetOddsSuffix(bet: SideBet, team: string) {
  const odds = sideBetOddsForTeam(bet, team);
  return odds === 100 ? "" : ` ${americanOddsText(odds)}`;
}

export function sideBetTotalSideForTeam(bet: SideBet, team: string): SideBetTotalSide {
  const creatorSide = bet.creator_total_side === "under" ? "under" : "over";
  return team === bet.creator_team ? creatorSide : oppositeTotalSide(creatorSide);
}

export function sideBetLineText(bet: SideBet, team: string) {
  const creatorSide = team === bet.creator_team;
  const odds = sideBetOddsForTeam(bet, team);
  const spread = bet.market_type === "moneyline" || bet.market_type === "total"
    ? null
    : Number(creatorSide ? bet.creator_spread : bet.offered_spread);
  return sideBetMarketText(
    bet.market_type,
    spread,
    odds,
    bet.total_points == null ? null : Number(bet.total_points),
    bet.market_type === "total" ? sideBetTotalSideForTeam(bet, team) : null
  );
}

