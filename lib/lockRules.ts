import { setDay, subHours } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Chicago";

// JS day: 0 Sunday, 1 Monday, 2 Tuesday, 3 Wednesday, 4 Thursday, 5 Friday, 6 Saturday.
export function getGameLockTime(commenceTimeIso: string, timezone = APP_TIMEZONE): Date {
  const kickoffUtc = new Date(commenceTimeIso);
  const kickoffLocal = toZonedTime(kickoffUtc, timezone);
  const day = kickoffLocal.getDay();

  // Tuesday-Friday games lock 24 hours before kickoff.
  if ([2, 3, 4, 5].includes(day)) {
    return subHours(kickoffUtc, 24);
  }

  // Saturday/Sunday/Monday games lock Friday at 5:00 PM CT before that football weekend.
  const fridayLocal = setDay(kickoffLocal, 5, { weekStartsOn: 1 });
  const lockLocal = new Date(fridayLocal);
  lockLocal.setHours(17, 0, 0, 0);

  if (lockLocal.getTime() > kickoffLocal.getTime()) {
    lockLocal.setDate(lockLocal.getDate() - 7);
  }

  return fromZonedTime(lockLocal, timezone);
}

export function getFootballWeek(dateIso: string, timezone = APP_TIMEZONE): number {
  // Week 0 covers college games before the main Week 1 Saturday.
  // Week 1 starts around Aug 25; everything before that is Week 0.
  const local = toZonedTime(new Date(dateIso), timezone);
  const seasonStart = new Date(local.getFullYear(), 7, 25, 0, 0, 0, 0);
  const diff = local.getTime() - seasonStart.getTime();
  return Math.max(0, Math.ceil(diff / (7 * 24 * 60 * 60 * 1000)));
}

export function getWeekOpenTimeFromCommenceTimes(commenceTimes: string[], timezone = APP_TIMEZONE): Date | null {
  if (!commenceTimes.length) return null;
  const earliest = commenceTimes
    .map((iso) => toZonedTime(new Date(iso), timezone))
    .sort((a, b) => a.getTime() - b.getTime())[0];

  // Picks for a week open Monday at 12:00 AM local time of that football week.
  const mondayLocal = setDay(earliest, 1, { weekStartsOn: 1 });
  mondayLocal.setHours(0, 0, 0, 0);

  if (mondayLocal.getTime() > earliest.getTime()) {
    mondayLocal.setDate(mondayLocal.getDate() - 7);
  }

  return fromZonedTime(mondayLocal, timezone);
}

export function getPickWeekOpenTime(week: number, commenceTimes: string[], timezone = APP_TIMEZONE): Date | null {
  // Week 1 is intentionally available early so the league can review and save its opening cards.
  if (week === 1) return null;
  return getWeekOpenTimeFromCommenceTimes(commenceTimes, timezone);
}

export function isClosed(lockTimeIso: string, now = new Date()) {
  return now.getTime() >= new Date(lockTimeIso).getTime();
}
