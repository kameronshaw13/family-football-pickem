import { toZonedTime } from "date-fns-tz";
import type { Game } from "@/lib/types";
import { APP_TIMEZONE } from "@/lib/lockRules";

type SeasonGame = Pick<Game, "league" | "commence_time" | "home_team" | "away_team">;

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
  kickoff.setDate(kickoff.getDate() + 3);
  return kickoff;
}

export function isNflRegularSeason(commenceTime: string, timezone = APP_TIMEZONE) {
  const local = toZonedTime(new Date(commenceTime), timezone);
  const seasonYear = local.getMonth() >= 6 ? local.getFullYear() : local.getFullYear() - 1;
  const kickoff = nflKickoff(seasonYear);
  const end = new Date(kickoff);
  end.setDate(end.getDate() + 18 * 7);
  return local >= kickoff && local < end;
}

export function isCfbRegularSeason(game: Pick<SeasonGame, "commence_time" | "home_team" | "away_team">, timezone = APP_TIMEZONE) {
  const local = toZonedTime(new Date(game.commence_time), timezone);
  const month = local.getMonth();
  if (month >= 7 && month <= 10) return true;
  return month === 11 && local.getDate() <= 8;
}

export function isEligibleRegularSeasonGame(game: SeasonGame) {
  return game.league === "CFB" ? isCfbRegularSeason(game) : isNflRegularSeason(game.commence_time);
}
