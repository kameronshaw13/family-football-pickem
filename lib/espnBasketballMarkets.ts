import type { Game, SideBetMarketQuote } from "./types";
import { fetchEspnSchedule, type EspnScheduleGame } from "./espnSchedule.ts";
import { alignSpreadFavoriteWithMoneyline, normalizeVerifiedMarketSpread } from "./marketSpread.ts";
import { normalizeTeamNameKey } from "./teamNames.ts";

function finite(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function odds(value: unknown) {
  const parsed = finite(value);
  return parsed != null && Number.isInteger(parsed) && Math.abs(parsed) >= 100 ? parsed : null;
}
type BasketballOddsEvent = Pick<EspnScheduleGame, "id" | "homeTeam" | "awayTeam" | "statusState" | "draftKingsOdds">;

function marketTeamOrder(game: Game, event: BasketballOddsEvent, row: any) {
  const key = normalizeTeamNameKey;
  const savedHome = key(game.home_team);
  const savedAway = key(game.away_team);
  const eventHome = key(event.homeTeam.displayName);
  const eventAway = key(event.awayTeam.displayName);
  const direct = savedHome === eventHome && savedAway === eventAway;
  const swapped = savedHome === eventAway && savedAway === eventHome;
  if (direct === swapped) return null;

  // The market can carry its own side assignments. Match those team IDs
  // before trusting the scoreboard's home/away labels.
  const homeId = row.homeTeamOdds?.team?.id;
  const awayId = row.awayTeamOdds?.team?.id;
  if (homeId == null && awayId == null) return swapped;
  const matches = (marketId: unknown, eventId?: string) => marketId == null || String(marketId) === eventId;
  const marketDirect = matches(homeId, event.homeTeam.id) && matches(awayId, event.awayTeam.id);
  const marketSwapped = matches(homeId, event.awayTeam.id) && matches(awayId, event.homeTeam.id);
  if (marketDirect === marketSwapped) return null;
  return swapped !== marketSwapped;
}

/** ESPN's explicitly identified DraftKings pregame row, aligned to the saved teams. */
export function espnDraftKingsBasketballQuote(game: Game, event: BasketballOddsEvent, now = new Date()): SideBetMarketQuote | null {
  const row = event.draftKingsOdds as any;
  if ((game.league !== "NBA" && game.league !== "CBB") || event.id !== game.espn_event_id
    || event.statusState !== "pre" || now >= new Date(game.commence_time) || !/^draftkings$/i.test(row?.provider?.name || "")) return null;
  const swapped = marketTeamOrder(game, event, row);
  if (swapped == null) return null;
  const rawAway = finite(row.pointSpread?.away?.close?.line);
  const rawHome = finite(row.pointSpread?.home?.close?.line);
  const magnitude = finite(row.spread);
  const providerAwayPoint = rawAway ?? (magnitude != null && row.awayTeamOdds?.favorite != null ? Math.abs(magnitude) * (row.awayTeamOdds.favorite ? -1 : 1) : null);
  const providerHomePoint = rawHome ?? (providerAwayPoint != null ? -providerAwayPoint : null);
  const [awayPoint, homePoint] = swapped ? [providerHomePoint, providerAwayPoint] : [providerAwayPoint, providerHomePoint];
  const away = swapped ? "home" : "away";
  const home = swapped ? "away" : "home";
  const awayOdds = odds(row.moneyline?.[away]?.close?.odds ?? row[`${away}TeamOdds`]?.moneyLine);
  const homeOdds = odds(row.moneyline?.[home]?.close?.odds ?? row[`${home}TeamOdds`]?.moneyLine);
  const points = finite(row.overUnder);
  const spread = normalizeVerifiedMarketSpread(game.league, awayPoint != null && homePoint != null
    ? { awayPoint, homePoint, awayOdds: odds(row.pointSpread?.[away]?.close?.odds), homeOdds: odds(row.pointSpread?.[home]?.close?.odds), suspended: false }
    : null);
  const moneyline = awayOdds != null && homeOdds != null ? { awayOdds, homeOdds, suspended: false } : null;
  const total = points != null && points > 0 ? { points, overOdds: odds(row.total?.over?.close?.odds), underOdds: odds(row.total?.under?.close?.odds), suspended: false } : null;
  const verifiedSpread = alignSpreadFavoriteWithMoneyline(spread, moneyline);
  return verifiedSpread || moneyline || total ? { gameId: game.id, phase: "pregame", status: "scheduled", spread: verifiedSpread, moneyline, total } : null;
}

export async function fetchEspnBasketballMarkets(games: Game[]) {
  const results = await Promise.allSettled((["CBB", "NBA"] as const).map(async (league) => {
    const candidates = games.filter((game) => game.league === league && new Date(game.commence_time) > new Date());
    if (!candidates.length) return [];
    // Late-night neutral-site games can be listed on the previous provider slate.
    // A single-game offer lookup needs the same adjacent-date coverage as the board.
    const schedule = await fetchEspnSchedule(league, candidates.map((game) => game.commence_time), 4, 1);
    const byId = new Map(schedule.map((game) => [game.id, game]));
    return candidates.flatMap((game) => {
      const event = game.espn_event_id ? byId.get(game.espn_event_id) : null;
      const quote = event ? espnDraftKingsBasketballQuote(game, event) : null;
      return quote ? [quote] : [];
    });
  }));
  return results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
}
