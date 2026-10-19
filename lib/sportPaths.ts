import type { League } from "./types";
export const LEAGUES: League[] = ["CFB", "NFL", "CBB", "NBA"];
export function espnSportPath(league: League) {
  return ({ CFB: "football/college-football", NFL: "football/nfl", CBB: "basketball/mens-college-basketball", NBA: "basketball/nba" })[league];
}
export function gamePickLockTime(game: {league: string; commence_time: string}, footballLock: (iso: string) => Date) {
  return game.league === "CBB" || game.league === "NBA"
    ? new Date(new Date(game.commence_time).getTime() - 3600000)
    : footballLock(game.commence_time);
}
