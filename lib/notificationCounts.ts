export const NOTIFICATION_DESTINATIONS = [
  "side_bets_received",
  "side_bets_sent",
  "my_card",
  "league_cards",
  "side_bet_ledger"
] as const;

export type NotificationDestination = typeof NOTIFICATION_DESTINATIONS[number];
export type NotificationCounts = Record<NotificationDestination, number> & { total: number };

type NotificationCountRow = {
  destination: string;
  read_at: string | null;
  action_required?: boolean;
};

export function countUnreadNotifications(rows: NotificationCountRow[]): NotificationCounts {
  const counts: NotificationCounts = {
    side_bets_received: 0,
    side_bets_sent: 0,
    my_card: 0,
    league_cards: 0,
    side_bet_ledger: 0,
    total: 0
  };

  for (const notification of rows) {
    if (notification.read_at || !NOTIFICATION_DESTINATIONS.includes(notification.destination as NotificationDestination)) continue;
    const destination = notification.destination as NotificationDestination;
    counts[destination] += 1;
    counts.total += 1;
  }

  return counts;
}
