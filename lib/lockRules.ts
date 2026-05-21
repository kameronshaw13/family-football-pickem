import { addDays, setDay, subHours } from "date-fns";
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
  // For Saturday: previous day Friday. Sunday: two days before. Monday: three days before.
  const fridayLocal = setDay(kickoffLocal, 5, { weekStartsOn: 1 });
  const lockLocal = new Date(fridayLocal);
  lockLocal.setHours(17, 0, 0, 0);

  // If the computed Friday is after kickoff local due to week boundary weirdness, go back one week.
  if (lockLocal.getTime() > kickoffLocal.getTime()) {
    lockLocal.setDate(lockLocal.getDate() - 7);
  }

  return fromZonedTime(lockLocal, timezone);
}

export function getRevealTime(commenceTimeIso: string, timezone = APP_TIMEZONE): Date {
  const kickoffLocal = toZonedTime(new Date(commenceTimeIso), timezone);
  const day = kickoffLocal.getDay();
  if ([2, 3, 4].includes(day)) return getGameLockTime(commenceTimeIso, timezone);
  if (day === 5) return getGameLockTime(commenceTimeIso, timezone);
  return getGameLockTime(commenceTimeIso, timezone);
}

export function getFootballWeek(dateIso: string, timezone = APP_TIMEZONE): number {
  // Simple season-week bucket for the app UI. Admin can override in Supabase if needed.
  const local = toZonedTime(new Date(dateIso), timezone);
  const seasonStart = new Date(local.getFullYear(), 7, 25); // approx late August
  const diff = local.getTime() - seasonStart.getTime();
  return Math.max(1, Math.ceil(diff / (7 * 24 * 60 * 60 * 1000)));
}

export function isClosed(lockTimeIso: string, now = new Date()) {
  return now.getTime() >= new Date(lockTimeIso).getTime();
}
