import { fromZonedTime, toZonedTime } from "date-fns-tz";
import type { Game } from "@/lib/types";
import { APP_TIMEZONE, getFootballWeek } from "@/lib/lockRules";
import { isFbsTeamGame } from "@/lib/cfbConferences";

type SeasonGame = Pick<Game, "league" | "commence_time" | "home_team" | "away_team"> &
  Partial<Pick<Game, "home_logo_url" | "away_logo_url">>;

export function isChargersTeam(team: string) {
  return /(^|\s)chargers$/i.test(team.trim());
}

export function hasChargers(game: Pick<SeasonGame, "home_team" | "away_team">) {
  return isChargersTeam(game.home_team) || isChargersTeam(game.away_team);
}

function nflKickoff(year: number) {
  const laborDay = new Date(year, 8, 1, 0, 0, 0, 0);
  while (laborDay.getDay() !== 1) laborDay.setDate(laborDay.getDate() + 1);
  const kickoff = new Date(laborDay);
  // The 2026 season opens Wednesday; the standard opener is Thursday.
  kickoff.setDate(kickoff.getDate() + (year === 2026 ? 2 : 3));
  return kickoff;
}

function footballSeasonYear(local: Date) {
  return local.getMonth() >= 6 ? local.getFullYear() : local.getFullYear() - 1;
}

function nflRegularSeasonEndLocal(seasonYear: number) {
  const firstSunday = nflKickoff(seasonYear);
  while (firstSunday.getDay() !== 0) firstSunday.setDate(firstSunday.getDate() + 1);
  const finalSunday = new Date(firstSunday);
  finalSunday.setDate(finalSunday.getDate() + 17 * 7);
  const end = new Date(finalSunday);
  end.setDate(end.getDate() + 1);
  end.setHours(0, 0, 0, 0);
  return end;
}

export function footballSeasonYearAt(date: Date, timezone = APP_TIMEZONE) {
  return footballSeasonYear(toZonedTime(date, timezone));
}

export function nflRegularSeasonEnd(seasonYear: number, timezone = APP_TIMEZONE) {
  return fromZonedTime(nflRegularSeasonEndLocal(seasonYear), timezone);
}

export function finalPickemWeek(seasonYear: number, timezone = APP_TIMEZONE) {
  const finalInstant = new Date(nflRegularSeasonEnd(seasonYear, timezone).getTime() - 1);
  return getFootballWeek(finalInstant.toISOString(), timezone);
}

export function isNflRegularSeason(commenceTime: string, timezone = APP_TIMEZONE) {
  const local = toZonedTime(new Date(commenceTime), timezone);
  const seasonYear = footballSeasonYear(local);
  const kickoff = nflKickoff(seasonYear);
  return local >= kickoff && local < nflRegularSeasonEndLocal(seasonYear);
}

export function isCfbPickemSeason(game: Pick<SeasonGame, "commence_time" | "home_team" | "away_team">, timezone = APP_TIMEZONE) {
  const local = toZonedTime(new Date(game.commence_time), timezone);
  const seasonYear = footballSeasonYear(local);
  const seasonStart = new Date(seasonYear, 7, 1, 0, 0, 0, 0);
  return local >= seasonStart && local < nflRegularSeasonEndLocal(seasonYear);
}

export function isEligibleSeasonGame(game: SeasonGame) {
  return game.league === "CFB"
    ? isCfbPickemSeason(game) && isFbsTeamGame(game)
    : isNflRegularSeason(game.commence_time);
}
