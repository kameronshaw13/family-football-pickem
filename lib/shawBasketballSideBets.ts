import { fromZonedTime } from "date-fns-tz";
import { getFootballWeek } from "./lockRules.ts";

export const SHAW_SIDE_BET_LEAGUES = ["CFB", "NFL", "CBB", "NBA"] as const;
export function isShawBasketballSideBet(slug: string, league: string) {
  return slug === "shaw-family" && (league === "CBB" || league === "NBA");
}

/** Shaw uses its own Tuesday–Monday football week, never the basketball game's stored week. */
export function sideBetWeekForGame(slug: string, game: { league: string; week: number; commence_time: string }, timezone: string) {
  return isShawBasketballSideBet(slug, game.league)
    ? getFootballWeek(game.commence_time, timezone)
    : Number(game.week);
}

export function shawSideBetWeekBounds(seasonYear: number, week: number, timezone: string) {
  const tuesday = new Date(Date.UTC(seasonYear, 7, 24));
  while (tuesday.getUTCDay() !== 2) tuesday.setUTCDate(tuesday.getUTCDate() + 1);
  tuesday.setUTCDate(tuesday.getUTCDate() + (week - 1) * 7);
  const end = new Date(tuesday);
  end.setUTCDate(end.getUTCDate() + 7);
  return {
    start: fromZonedTime(tuesday.toISOString().slice(0, 10) + "T00:00:00", timezone).toISOString(),
    end: fromZonedTime(end.toISOString().slice(0, 10) + "T00:00:00", timezone).toISOString()
  };
}

/** PostgREST filter: football uses stored weeks; basketball uses Shaw's calendar dates. */
export function sideBetWeekFilter(slug: string, seasonYear: number, week: number, timezone: string) {
  if (slug !== "shaw-family") return `week.eq.${week}`;
  const { start, end } = shawSideBetWeekBounds(seasonYear, week, timezone);
  return `and(league.in.(CFB,NFL),week.eq.${week}),and(league.in.(CBB,NBA),commence_time.gte.${start},commence_time.lt.${end})`;
}
