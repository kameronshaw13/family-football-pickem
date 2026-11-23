import type { NotificationCounts, NotificationDestination } from "./notificationCounts.ts";

/** Shared notification transport and read-only presentation calculations.
 * Network scheduling, optimistic state and navigation are owned by the app.
 */
export type NotificationGroup = "shaw-family" | "other-family" | "friends" | "friends-basketball";

export function normalizeNotificationCounts(next: Record<string, number>): NotificationCounts {
  return {
    side_bets_received: Number(next.side_bets_received || 0),
    side_bets_sent: Number(next.side_bets_sent || 0),
    my_card: Number(next.my_card || 0),
    league_cards: Number(next.league_cards || 0),
    side_bet_ledger: Number(next.side_bet_ledger || 0),
    total: Number(next.total || 0)
  };
}

export function notificationFetchRequest(token: string, group: NotificationGroup) {
  return {
    url: "/api/notifications",
    init: {
      headers: { Authorization: `Bearer ${token}`, "x-pickem-group": group },
      cache: "no-store" as const
    }
  };
}

export function notificationReadRequest(destination: NotificationDestination, token: string, group: NotificationGroup) {
  return {
    url: "/api/notifications",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-pickem-group": group },
      body: JSON.stringify({ action: "read", destination })
    }
  };
}

/** Optimistically mark only the selected destination read, never other sections. */
export function locallyReadNotifications(current: NotificationCounts, destination: NotificationDestination): NotificationCounts {
  return {
    ...current,
    [destination]: 0,
    total: Math.max(0, current.total - current[destination])
  };
}
