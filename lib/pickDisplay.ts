import type { Game } from "./types.ts";
import { normalizeSpreadForSelectedTeam, spreadText, underdogWinValue } from "./spreads.ts";

/** Formatting helpers shared by pick board and pick cards. */
export function dogBonusText(value: number | string, pointsMode: boolean) {
  if (!pointsMode) return `+${value}W`;
  return `+${value} ${Number(value) === 1 ? "Pt" : "Pts"}`;
}

export function dogLineText(game: Game, team: string, pointsMode: boolean) {
  const spread = normalizeSpreadForSelectedTeam(team, game.current_spread_team, game.current_spread);
  const value = underdogWinValue(spread);
  return `${spreadText(spread)} = ${dogBonusText(value, pointsMode)}`;
}

export function confidencePointText(value: number) {
  return `${value} ${value === 1 ? "pt" : "pts"}`;
}

