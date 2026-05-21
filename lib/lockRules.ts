import { setDay, subHours } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Chicago";

// JS day: 0 Sunday, 1 Monday, 2 Tuesday, 3 Wednesday, 4 Thursday, 5 Friday, 6 Saturday.
export function getGameLockTime(commenceTimeIso: string, timezone = APP_TIMEZONE): Date {
  const kickoffUtc = new Date(commenceTimeIso);
  const kickoffLocal = toZonedTime(kickoffUtc, timezone);
  const day = kickoffLocal.getDay();

  // Tuesday-Friday games lock 24 hours before kickoff.
  if ([2, 3, 4, 5].includes(day)) return subHours(kickoffUtc, 24);

  // Saturday/Sunday/Monday games lock Friday at 5:00 PM CT before that football weekend.
  const fridayLocal = setDay(kickoffLocal, 5, { weekStartsOn: 1 });
  const lockLocal = new Date(fridayLocal);
  lockLocal.setHours(17, 0, 0, 0);
  if (lockLocal.getTime() > kickoffLocal.getTime()) lockLocal.setDate(lockLocal.getDate() - 7);
  return fromZonedTime(lockLocal, timezone);
}

export function getFootballWeek(dateIso: string, timezone = APP_TIMEZONE): number {
  const local = toZonedTime(new Date(dateIso), timezone);
  const year = local.getFullYear();
  const aug23 = new Date(year, 7, 23);
  const firstSaturday = new Date(aug23);
  while (firstSaturday.getDay() !== 6) firstSaturday.setDate(firstSaturday.getDate() + 1);
  firstSaturday.setHours(0, 0, 0, 0);

  const diff = local.getTime() - firstSaturday.getTime();
  return Math.max(0, Math.floor(diff / (7 * 24 * 60 * 60 * 1000)));
}

export function isClosed(lockTimeIso: string, now = new Date()) {
  return now.getTime() >= new Date(lockTimeIso).getTime();
}
