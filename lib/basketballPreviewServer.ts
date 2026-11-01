import { createAsyncCache } from "./asyncCache";
import { espnSportPath } from "./sportPaths";
import type { League } from "./types";

const cache = createAsyncCache<any[]>(5 * 60_000, 256);
export function basketballSeasonYear(date: string) {
  const value = new Date(date);
  return value.getUTCFullYear() + (value.getUTCMonth() >= 6 ? 1 : 0);
}
export function fetchBasketballTeamSeason(league: League, teamId: string, year: number, seasonType: number) {
  return cache(`${league}:${teamId}:${year}:${seasonType}`, async () => {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${espnSportPath(league)}/teams/${encodeURIComponent(teamId)}/schedule?season=${year}&seasontype=${seasonType}`;
    const response = await fetch(url, { next: { revalidate: 300 }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Team schedule temporarily unavailable.");
    const data = await response.json();
    const returnedYear = Number(data.requestedSeason?.year ?? data.season?.year);
    if (Number.isFinite(returnedYear) && returnedYear !== year) throw new Error("The provider returned a different season.");
    if (!Array.isArray(data.events)) throw new Error("Team schedule temporarily unavailable.");
    return data.events;
  });
}
