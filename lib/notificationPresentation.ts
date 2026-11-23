import type { NotificationCounts } from "@/lib/notificationCounts";

/** Single source for bottom navigation and section-tab unread counts.
 * Visibility preference affects what is shown, never the stored notifications.
 */
export function navigationNotificationCounts(counts: NotificationCounts, hideAcceptedBets: boolean, previewActive: boolean) {
  const receivedNotificationCount = hideAcceptedBets ? 0 : previewActive ? 1 : counts.side_bets_received;
  const sentNotificationCount = hideAcceptedBets ? 0 : previewActive ? 1 : counts.side_bets_sent;
  const myCardNotificationCount = previewActive ? 1 : counts.my_card;
  const leagueCardsNotificationCount = previewActive ? 1 : counts.league_cards;
  const bankNotificationCount = hideAcceptedBets ? 0 : previewActive ? 1 : counts.side_bet_ledger;
  const picksNotificationCount = receivedNotificationCount + sentNotificationCount;
  const cardNotificationCount = myCardNotificationCount + leagueCardsNotificationCount;
  const navNotificationCounts: Partial<Record<"picks" | "card" | "standings", number>> = {
    picks: picksNotificationCount,
    card: cardNotificationCount,
    standings: bankNotificationCount
  };
  return {
    receivedNotificationCount,
    sentNotificationCount,
    myCardNotificationCount,
    leagueCardsNotificationCount,
    bankNotificationCount,
    picksNotificationCount,
    cardNotificationCount,
    navNotificationCounts
  };
}
