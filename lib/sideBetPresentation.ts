import type { SideBet } from "./types.ts";
import {
  sideBetBettorForTeam,
  sideBetLedgerPerspective,
  sideBetOfferIsPending,
  sideBetPerspective,
  sideBetsForView as baseSideBetsForView,
  sideBetResponseSummary as baseSideBetResponseSummary
} from "./sideBetPresentationBase.ts";

export type { SideBetResponseSummary, SideBetResponseTone, SideBetViewMode } from "./sideBetPresentationBase.ts";
export { sideBetBettorForTeam, sideBetLedgerPerspective, sideBetOfferIsPending, sideBetPerspective };

type PresentationSideBet = SideBet & { __presentationExpired?: boolean };

export function sideBetsForView(bets: SideBet[], userId: string, mode: "received" | "sent") {
  return baseSideBetsForView(bets, userId, mode).map((bet) => {
    if (bet.status !== "expired") return bet;
    return { ...bet, status: "cancelled", __presentationExpired: true } as PresentationSideBet;
  });
}

export function sideBetResponseSummary(bet: SideBet, userId: string, mode: "received" | "sent") {
  const presentationBet = bet as PresentationSideBet;
  if (presentationBet.__presentationExpired) {
    return { subjectFull: "Offer", subjectCompact: "Offer", action: "Expired" as const, tone: "declined" as const };
  }

  const summary = baseSideBetResponseSummary(bet, userId, mode);
  const targets = bet.targets || [];

  if (mode === "received" && summary.action === "Accepted" && summary.subjectFull === "You") {
    const creatorName = bet.creator?.display_name || "Player";
    return {
      ...summary,
      recipientFull: `from ${creatorName}`,
      recipientCompact: `from ${creatorName}`
    };
  }

  if (mode === "sent" && bet.status === "open") {
    const pending = targets.filter((target) => target.response === "pending");
    if (pending.length && summary.action === "Offered") {
      const firstName = pending[0]?.recipient?.display_name || "Player";
      const compactNames = pending.length === 1 ? firstName : `${firstName} +${pending.length - 1}`;
      return {
        ...summary,
        recipientFull: `to ${summary.recipientFull || firstName}`,
        recipientCompact: `to ${compactNames}`
      };
    }
  }

  if (mode === "sent" && summary.action === "Declined") {
    const declined = targets.filter((target) => target.response === "declined");
    if (declined.length) {
      const firstName = declined[0]?.recipient?.display_name || "Player";
      return { ...summary, subjectCompact: declined.length === 1 ? firstName : `${firstName} +${declined.length - 1}` };
    }
  }

  return summary;
}
