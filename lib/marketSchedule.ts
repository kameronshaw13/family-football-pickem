export const MARKET_REFRESH_SCHEDULE = "Tue 7:50 AM pre-open; Tue-Fri every 30m 8:20 AM-8:50 PM CT; Sun/Mon 8:50 AM; Sat 8:50 PM and 9:50 PM CT";

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

  if (weekday === "Tue" && hour === 7 && minute === 50) {
    return { shouldRefresh: true, refreshFuture: true };
  }
  if (["Tue", "Wed", "Thu", "Fri"].includes(weekday) && hour >= 8 && hour <= 20) {
    return { shouldRefresh: true, refreshFuture: hour === 8 && minute === 50 };
  }
  if (["Sun", "Mon"].includes(weekday) && hour === 8 && minute === 50) {
    return { shouldRefresh: true, refreshFuture: true };
  }
  if (weekday === "Sat" && (hour === 20 || hour === 21) && minute === 50) {
    return { shouldRefresh: true, refreshFuture: hour === 20 };
  }
  return { shouldRefresh: false, refreshFuture: false };
}
