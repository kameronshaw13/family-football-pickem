import { fromZonedTime, toZonedTime } from "date-fns-tz";

export const BASKETBALL_GROUP = "friends-basketball";
export const BASKETBALL_TIMEZONE = "America/Chicago";
export const BASKETBALL_LEAGUES = ["CBB", "NBA"] as const;
export const BASKETBALL_2026_CALENDAR = {
  startDate: "2026-11-01",
  endDateExclusive: "2027-04-12",
  tournamentStartDate: "2027-03-15",
  tournamentEndDateExclusive: "2027-04-12"
};
export type BasketballCalendar = typeof BASKETBALL_2026_CALENDAR;

export function isBasketballLeague(league: string) {
  return league === "CBB" || league === "NBA";
}
export function isBasketballRules(rules: any) {
  return rules?.sport === "basketball";
}
export function basketballCalendar(rules?: any): BasketballCalendar {
  return { ...BASKETBALL_2026_CALENDAR, ...rules?.calendar };
}
function localDate(date: Date, timezone: string) {
  const local = toZonedTime(date, timezone);
  return Date.UTC(local.getFullYear(), local.getMonth(), local.getDate());
}
function dateNumber(iso: string) {
  return Date.parse(`${iso}T00:00:00Z`);
}
function addDays(iso: string, days: number) {
  return new Date(dateNumber(iso) + days * 86400000).toISOString().slice(0, 10);
}
function firstWeekEnd(rules?: any) {
  const start = basketballCalendar(rules).startDate;
  const weekday = new Date(`${start}T00:00:00Z`).getUTCDay();
  // Include the Sunday opener with the following Monday–Sunday card.
  return addDays(start, weekday === 0 ? 8 : 8 - weekday);
}
export function basketballWeek(now = new Date(), rules?: any, timezone = BASKETBALL_TIMEZONE) {
  const date = localDate(now, timezone);
  const end = dateNumber(firstWeekEnd(rules));
  return date < end ? 1 : Math.floor((date - end) / (7 * 86400000)) + 2;
}
export function basketballWeekBounds(week: number, rules?: any, timezone = BASKETBALL_TIMEZONE) {
  const calendar = basketballCalendar(rules);
  const openingEnd = firstWeekEnd(rules);
  const startDate = week <= 1 ? calendar.startDate : addDays(openingEnd, (week - 2) * 7);
  const endDate = week <= 1 ? openingEnd : addDays(startDate, 7);
  return {
    start: fromZonedTime(`${startDate}T00:00:00`, timezone),
    end: fromZonedTime(`${endDate}T00:00:00`, timezone),
    startDate,
    endDate
  };
}
export function basketballFinalWeek(rules?: any) {
  const c = basketballCalendar(rules);
  return 1 + Math.max(0, Math.ceil((dateNumber(c.endDateExclusive) - dateNumber(firstWeekEnd(rules))) / (7 * 86400000)));
}
export function basketballSeasonEnd(rules?: any, timezone = BASKETBALL_TIMEZONE) {
  return fromZonedTime(`${basketballCalendar(rules).endDateExclusive}T00:00:00`, timezone);
}
export function basketballGameInSeason(commenceTime: string, rules?: any, timezone = BASKETBALL_TIMEZONE) {
  const c = basketballCalendar(rules);
  const date = localDate(new Date(commenceTime), timezone);
  return date >= dateNumber(c.startDate) && date < dateNumber(c.endDateExclusive);
}
export function basketballPayoutMultiplier(week: number, rules?: any) {
  const c = basketballCalendar(rules);
  const { startDate, endDate } = basketballWeekBounds(week, rules);
  return startDate < c.tournamentEndDateExclusive && endDate > c.tournamentStartDate ? 2 : 1;
}
export function basketballLockTime(commenceTime: string) {
  return new Date(new Date(commenceTime).getTime() - 60 * 60 * 1000);
}
