import type { SideBet } from "./types";
import {
  sideBetBettorForTeam,
  sideBetLedgerPerspective,
  sideBetOfferIsPending,
  sideBetPerspective,
  sideBetsForView,
  sideBetResponseSummary as baseSideBetResponseSummary
} from "./sideBetPresentationBase";

export type { SideBetResponseSummary, SideBetResponseTone, SideBetViewMode } from "./sideBetPresentationBase";
export { sideBetBettorForTeam, sideBetLedgerPerspective, sideBetOfferIsPending, sideBetPerspective, sideBetsForView };

export function sideBetResponseSummary(bet: SideBet, userId: string, mode: "received" | "sent") {
  const summary = baseSideBetResponseSummary(bet, userId, mode);
  const targets = bet.targets || [];

  if (mode === "sent" && bet.status === "open") {
    const pending = targets.filter((target) => target.response === "pending");
    if (pending.length && summary.action === "Offered") {
      const firstName = pending[0]?.recipient?.display_name || "Player";
      return {
        ...summary,
        recipientCompact: pending.length === 1 ? firstName : `${firstName} +${pending.length - 1}`
      };
    }
  }

  if (mode === "sent" && summary.action === "Declined") {
    const declined = targets.filter((target) => target.response === "declined");
    if (declined.length) {
      const firstName = declined[0]?.recipient?.display_name || "Player";
      return {
        ...summary,
        subjectCompact: declined.length === 1 ? firstName : `${firstName} +${declined.length - 1}`
      };
    }
  }

  return summary;
}
