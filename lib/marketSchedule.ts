export const MARKET_REFRESH_SCHEDULE = "Tue 7:50 AM pre-open; every day 7:20 AM-11:50 PM CT at :20 and :50; schedules checked hourly and Saturday more often";

export function scheduledMarketRefreshWindow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value || "";
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (minute !== 20 && minute !== 50) return { shouldRefresh: false, refreshFuture: false };
  if ((weekday === "Tue" || weekday === "Sat") && hour === 7 && minute === 50) return { shouldRefresh: true, refreshFuture: true };
  if (hour >= 7 && hour <= 23) {
    const refreshFuture = (hour === 8 && minute === 50) ||
      (weekday === "Sat" && hour === 20 && minute === 50);
    return { shouldRefresh: true, refreshFuture };
  }
  return { shouldRefresh: false, refreshFuture: false };
}
