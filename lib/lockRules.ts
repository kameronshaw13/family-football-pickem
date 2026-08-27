import { setDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Chicago";

// JS day: 0 Sunday, 1 Monday, 2 Tuesday, 3 Wednesday, 4 Thursday, 5 Friday, 6 Saturday.
export function getGameLockTime(commenceTimeIso: string, timezone = APP_TIMEZONE): Date {
  const kickoffUtc = new Date(commenceTimeIso);
  const kickoffLocal = toZonedTime(kickoffUtc, timezone);
  const day = kickoffLocal.getDay();

  // Tuesday-Friday picks close at kickoff.
  if ([2, 3, 4, 5].includes(day)) {
    return kickoffUtc;
  }

  // Saturday/Sunday/Monday games lock Saturday at 11:00 AM CT for that football weekend.
  const saturdayLocal = setDay(kickoffLocal, 6, { weekStartsOn: 1 });
  const lockLocal = new Date(saturdayLocal);
  lockLocal.setHours(11, 0, 0, 0);

  if (lockLocal.getTime() > kickoffLocal.getTime()) {
    lockLocal.setDate(lockLocal.getDate() - 7);
  }

  return fromZonedTime(lockLocal, timezone);
}

export function getSpreadFreezeTime(commenceTimeIso: string, timezone = APP_TIMEZONE): Date {
  const kickoffUtc = new Date(commenceTimeIso);
  const kickoffLocal = toZonedTime(kickoffUtc, timezone);
  const day = kickoffLocal.getDay();

  // Tuesday-Friday spreads freeze one hour before kickoff.
  if ([2, 3, 4, 5].includes(day)) {
    return new Date(kickoffUtc.getTime() - 60 * 60 * 1000);
  }

  // Saturday-Monday lines receive their final scheduled refresh Saturday morning
  // and freeze at 10:00 AM CT, one hour before the shared 11:00 AM pick lock.
  const saturdayLocal = setDay(kickoffLocal, 6, { weekStartsOn: 1 });
  const freezeLocal = new Date(saturdayLocal);
  freezeLocal.setHours(10, 0, 0, 0);

  if (freezeLocal.getTime() > kickoffLocal.getTime()) {
    freezeLocal.setDate(freezeLocal.getDate() - 7);
  }

  return fromZonedTime(freezeLocal, timezone);
}

export function canRefreshSpread(commenceTimeIso: string, now = new Date(), timezone = APP_TIMEZONE) {
  const freezeTime = getSpreadFreezeTime(commenceTimeIso, timezone);

  return now <= freezeTime;
}

export function getFootballWeek(dateIso: string, timezone = APP_TIMEZONE): number {
  const local = toZonedTime(new Date(dateIso), timezone);
  const seasonYear = local.getMonth() >= 6 ? local.getFullYear() : local.getFullYear() - 1;
  const seasonStart = new Date(seasonYear, 7, 24, 0, 0, 0, 0);
  while (seasonStart.getDay() !== 2) seasonStart.setDate(seasonStart.getDate() + 1);
  const diff = local.getTime() - seasonStart.getTime();
  return diff < 0 ? 0 : Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
}

export function getWeekOpenTimeFromCommenceTimes(commenceTimes: string[], timezone = APP_TIMEZONE): Date | null {
  if (!commenceTimes.length) return null;
  const earliest = commenceTimes
    .map((iso) => toZonedTime(new Date(iso), timezone))
    .sort((a, b) => a.getTime() - b.getTime())[0];

  const tuesdayLocal = new Date(earliest);
  const daysSinceTuesday = (tuesdayLocal.getDay() - 2 + 7) % 7;
  tuesdayLocal.setDate(tuesdayLocal.getDate() - daysSinceTuesday);
  tuesdayLocal.setHours(8, 0, 0, 0);

  return fromZonedTime(tuesdayLocal, timezone);
}

export function getPickWeekOpenTime(week: number, commenceTimes: string[], timezone = APP_TIMEZONE): Date | null {
  // Keep Week 1 open for preseason testing while later weeks follow the normal schedule.
  if (week === 1) return null;
  return getWeekOpenTimeFromCommenceTimes(commenceTimes, timezone);
}

export function isClosed(lockTimeIso: string, now = new Date()) {
  return now.getTime() >= new Date(lockTimeIso).getTime();
}
