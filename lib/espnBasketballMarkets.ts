import type { Game, SideBetMarketQuote } from "./types";
import { fetchEspnSchedule } from "./espnSchedule";

function finite(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function odds(value: unknown) {
  const parsed = finite(value);
  return parsed != null && Number.isInteger(parsed) && Math.abs(parsed) >= 100 ? parsed : null;
}
/** ESPN's explicitly identified DraftKings pregame row, never a live quote. */
export function espnDraftKingsBasketballQuote(game: Game, row: any, state: string | null, now = new Date()): SideBetMarketQuote | null {
  if ((game.league !== "NBA" && game.league !== "CBB") || state !== "pre" || now >= new Date(game.commence_time) || !/^draftkings$/i.test(row?.provider?.name || "")) return null;
  const rawAway = finite(row.pointSpread?.away?.close?.line);
  const rawHome = finite(row.pointSpread?.home?.close?.line);
  const magnitude = finite(row.spread);
  const awayPoint = rawAway ?? (magnitude != null && row.awayTeamOdds?.favorite != null ? Math.abs(magnitude) * (row.awayTeamOdds.favorite ? -1 : 1) : null);
  const homePoint = rawHome ?? (awayPoint != null ? -awayPoint : null);
  const awayOdds = odds(row.moneyline?.away?.close?.odds ?? row.awayTeamOdds?.moneyLine);
  const homeOdds = odds(row.moneyline?.home?.close?.odds ?? row.homeTeamOdds?.moneyLine);
  const points = finite(row.overUnder);
  const spread = awayPoint != null && homePoint != null && Math.abs(awayPoint + homePoint) < 0.001
    ? { awayPoint, homePoint, awayOdds: odds(row.pointSpread?.away?.close?.odds), homeOdds: odds(row.pointSpread?.home?.close?.odds), suspended: false } : null;
  const moneyline = awayOdds != null && homeOdds != null ? { awayOdds, homeOdds, suspended: false } : null;
  const total = points != null && points > 0 ? { points, overOdds: odds(row.total?.over?.close?.odds), underOdds: odds(row.total?.under?.close?.odds), suspended: false } : null;
  return spread || moneyline || total ? { gameId: game.id, phase: "pregame", status: "scheduled", spread, moneyline, total } : null;
}

export async function fetchEspnBasketballMarkets(games: Game[]) {
  const results = await Promise.allSettled((["CBB", "NBA"] as const).map(async (league) => {
    const candidates = games.filter((game) => game.league === league && new Date(game.commence_time) > new Date());
    if (!candidates.length) return [];
    const schedule = await fetchEspnSchedule(league, candidates.map((game) => game.commence_time), 4, 0);
    const byId = new Map(schedule.map((game) => [game.id, game]));
    return candidates.flatMap((game) => {
      const event = game.espn_event_id ? byId.get(game.espn_event_id) : null;
      const quote = event ? espnDraftKingsBasketballQuote(game, event.draftKingsOdds, event.statusState) : null;
      return quote ? [quote] : [];
    });
  }));
  return results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
}
