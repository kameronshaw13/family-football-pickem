import type { BankEntry, Profile, SideBet } from "./types.ts";
import { sideBetProfitForUser, sideBetRiskForUser } from "./sideBetMarkets.ts";

/**
 * Pure bank and Side Bet read-model calculations. These functions never modify
 * stored account balances, bets, results or payout rules.
 */
export function weeklyBankAmounts(
  profiles: Profile[],
  entries: BankEntry[],
  week: number,
  active: boolean
): Record<string, number | null> {
  if (!active) return {};
  return Object.fromEntries(profiles.map(profile => {
    const playerEntries = entries.filter(entry => entry.week === week && entry.user_id === profile.id);
    return [profile.id, playerEntries.length
      ? playerEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
      : null];
  }));
}

export function bankLeaderboardTotals({
  profiles, entries, sideBetBankTotals, bankBalances, previewActive, active
}: {
  profiles: Profile[];
  entries: BankEntry[];
  sideBetBankTotals?: Record<string, number> | null;
  bankBalances?: Record<string, number> | null;
  previewActive: boolean;
  active: boolean;
}) {
  if (!active) return [];
  return profiles.map(profile => ({
    id: profile.id,
    display_name: profile.display_name,
    total: !previewActive && bankBalances && Object.prototype.hasOwnProperty.call(bankBalances, profile.id)
      ? Number(bankBalances[profile.id] || 0)
      : entries.filter(entry => entry.user_id === profile.id)
        .reduce((sum, entry) => sum + Number(entry.amount || 0), 0) + Number(sideBetBankTotals?.[profile.id] || 0)
  })).sort((a, b) => b.total - a.total);
}

export function acceptedSideBetExposure(bets: SideBet[], userId: string) {
  const activeBets = bets.filter(bet =>
    bet.status === "accepted" && (bet.creator_id === userId || bet.accepted_by === userId));
  return {
    activeBets,
    activeCount: activeBets.length,
    potentialProfit: activeBets.reduce((sum, bet) => sum + sideBetProfitForUser(bet, userId), 0),
    potentialLoss: activeBets.reduce((sum, bet) => sum + sideBetRiskForUser(bet, userId), 0)
  };
}
