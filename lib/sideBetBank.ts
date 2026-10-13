import { sideBetCreatorProfit } from "./sideBetMarkets.ts";

export type BankSideBet = {
  status: string;
  creator_id: string;
  accepted_by?: string | null;
  amount: number;
  creator_odds?: number | null;
};

/**
 * Only offers a player has sent reserve their stake before acceptance.
 * Received offers reserve nothing until accepted, and an offer sent to
 * multiple recipients can only be accepted once.
 */
export function sideBetReservedFunds(bets: BankSideBet[]): Record<string, number> {
  const cents = new Map<string, number>();
  const reserve = (id: string, amount: number) => {
    const value = Math.max(0, Math.round(Number(amount || 0) * 100));
    if (!id || !Number.isFinite(value)) return;
    cents.set(id, (cents.get(id) || 0) + value);
  };

  for (const bet of bets) {
    if (bet.status === "open") {
      reserve(bet.creator_id, bet.amount);
    } else if (bet.status === "accepted" && bet.accepted_by) {
      reserve(bet.creator_id, bet.amount);
      reserve(bet.accepted_by, sideBetCreatorProfit(bet));
    }
  }

  return Object.fromEntries([...cents.entries()].map(([id, value]) => [id, value / 100]));
}

export function availableSideBetFunds(balance: number, reserved: number) {
  const cents = Math.round(Number(balance || 0) * 100) - Math.round(Number(reserved || 0) * 100);
  return Math.max(0, cents) / 100;
}

export function canCoverSideBetRisk(available: number, risk: number) {
  const cents = Math.round(Number(risk) * 100);
  return Number.isFinite(cents) && cents > 0 && cents <= Math.round(available * 100);
}
