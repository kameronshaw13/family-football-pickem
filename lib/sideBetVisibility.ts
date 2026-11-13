/** Cosmetic display filters only. Original bets and financial calculations are unchanged. */
type LedgerBet = { status: string; creator_id: string; accepted_by?: string | null };

export function visibleSideBetLedger<T extends LedgerBet>(bets: T[], viewerId: string, hideMine: boolean): T[] {
  return bets.filter((bet) =>
    (bet.status === "accepted" || bet.status === "settled") &&
    (!hideMine || (bet.creator_id !== viewerId && bet.accepted_by !== viewerId))
  );
}

export function visibleOwnSideBetOffers<T>(offers: T[], hideMine: boolean): T[] {
  return hideMine ? [] : offers;
}
