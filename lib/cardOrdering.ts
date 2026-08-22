import type { Game, Pick } from "./types";

function kickoffTime(pick: Pick, gamesById: ReadonlyMap<string, Game>) {
  const game = gamesById.get(pick.game_id) || pick.game;
  const value = game ? Date.parse(game.commence_time) : Number.NaN;
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

export function orderCardPicks(picks: Pick[], games: Game[], pointsMode: boolean) {
  const gamesById = new Map(games.map((game) => [game.id, game]));

  return [...picks].sort((a, b) => {
    const pickTypeOrder = Number(a.pick_type === "underdog") - Number(b.pick_type === "underdog");
    if (pickTypeOrder !== 0) return pickTypeOrder;

    if (pointsMode && a.pick_type === "regular") {
      const confidenceOrder = Number(b.confidence_points || 0) - Number(a.confidence_points || 0);
      if (confidenceOrder !== 0) return confidenceOrder;
    }

    return kickoffTime(a, gamesById) - kickoffTime(b, gamesById);
  });
}
