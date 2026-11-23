import type { Game } from "@/lib/types";
import { basketballWeekBounds } from "./basketballRules.ts";
import { gameDayKey, isFinalGame, isPostponedGame } from "./gameBoardStatus.ts";
import type { GroupRules } from "@/lib/rulePresentation";

/** Pure calendar calculations shared by football and basketball Pick Board.
 * Date selection state remains owned by the app to avoid moving user intent.
 */
export function boardCalendar({
  games, clock, week, currentWeek, basketball, rules, selectedDay
}: {
  games: Game[];
  clock: number;
  week: number;
  currentWeek: number;
  basketball: boolean;
  rules: GroupRules;
  selectedDay?: string | null;
}) {
  const todayDayKey = gameDayKey(new Date(clock).toISOString());
  const weekGameDays = Array.from(new Set(games.map(game => gameDayKey(game.commence_time)))).sort();
  const dateMs = (day: string) => Date.parse(day + "T12:00:00Z");
  const dayAt = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const weekAnchor = weekGameDays[0] || todayDayKey;
  const anchorMs = dateMs(weekAnchor);
  const anchorWeekday = new Date(anchorMs).getUTCDay();
  const footballWeekStart = dayAt(anchorMs - ((anchorWeekday + 5) % 7) * 86_400_000);
  const basketballBounds = basketball ? basketballWeekBounds(week, rules) : null;
  const weekStartDay = basketballBounds?.startDate || footballWeekStart;
  const exclusiveWeekEndDay = basketballBounds?.endDate || dayAt(dateMs(weekStartDay) + 7 * 86_400_000);
  const calendarDays = Array.from({
    length: Math.max(1, Math.min(14, Math.round((dateMs(exclusiveWeekEndDay) - dateMs(weekStartDay)) / 86_400_000)))
  }, (_, offset) => dayAt(dateMs(weekStartDay) + offset * 86_400_000));
  const distanceToToday = (day: string) => Math.abs(dateMs(day) - dateMs(todayDayKey));
  const gameDays = weekGameDays.filter(day => calendarDays.includes(day));
  const closestGameDay = gameDays.reduce((best, day) => !best || distanceToToday(day) < distanceToToday(best) ? day : best, "");
  const initialDayKey = week === currentWeek && calendarDays.includes(todayDayKey)
    ? todayDayKey : closestGameDay || calendarDays[0];
  const selectedDayKey = selectedDay && calendarDays.includes(selectedDay) ? selectedDay : initialDayKey;
  return { todayDayKey, calendarDays, selectedDayKey };
}

/** Live first, final second, upcoming last. Preserves original kickoff order. */
export function boardGameOrder(game: Game, clock: number): number {
  const kickoff = new Date(game.commence_time).getTime();
  return isFinalGame(game) ? 1
    : !isPostponedGame(game) && (game.live_state === "in" || kickoff <= clock) ? 0
    : 2;
}

export function sortBoardGames(games: Game[], clock: number): Game[] {
  return [...games].sort((a, b) =>
    boardGameOrder(a, clock) - boardGameOrder(b, clock) ||
    new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime() ||
    a.id.localeCompare(b.id));
}

export function favoriteGameKey(game: Game): string {
  return [game.league, game.week, game.away_team.trim().toLowerCase(), game.home_team.trim().toLowerCase()].join(":");
}

export function legacyFavoriteGameKey(game: Game): string {
  return `${game.league}:${game.espn_event_id || game.id}`;
}

export function boardLeagueGroups(games: Game[], basketball: boolean, clock: number) {
  const leagues = basketball ? ["CBB", "NBA"] : ["CFB", "NFL"];
  return leagues.map(league => ({
    league,
    label: league === "CBB" ? "College Basketball"
      : league === "NBA" ? "NBA Basketball"
      : league === "CFB" ? "College Football" : "NFL Football",
    games: games.filter(game => game.league === league)
  }))
    .filter(group => group.games.length > 0)
    .sort((a, b) => boardGameOrder(a.games[0], clock) - boardGameOrder(b.games[0], clock));
}
