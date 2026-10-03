export const LIVE_OFFER_SCORE_CONFIRMATION_MS = 20_000;

export type LiveOfferScoreState = "unchanged" | "changed" | "uncertain";

export type LiveOfferScoreCandidateAction =
  | { kind: "none" }
  | { kind: "start"; total: number; seenAt: string }
  | { kind: "clear" }
  | { kind: "expire" };

type CandidateInput = {
  scoreState: LiveOfferScoreState;
  currentTotal: number | null;
  candidateTotal: number | null;
  candidateSeenAt: string | null | undefined;
  nowMs: number;
};

export function liveOfferScoreCandidateAction({
  scoreState,
  currentTotal,
  candidateTotal,
  candidateSeenAt,
  nowMs
}: CandidateInput): LiveOfferScoreCandidateAction {
  if (scoreState !== "changed" || currentTotal == null || !Number.isFinite(currentTotal)) {
    return candidateTotal != null || candidateSeenAt ? { kind: "clear" } : { kind: "none" };
  }

  const candidateSeenMs = candidateSeenAt ? new Date(candidateSeenAt).getTime() : Number.NaN;
  if (candidateTotal !== currentTotal || !Number.isFinite(candidateSeenMs)) {
    return { kind: "start", total: currentTotal, seenAt: new Date(nowMs).toISOString() };
  }

  if (nowMs - candidateSeenMs >= LIVE_OFFER_SCORE_CONFIRMATION_MS) {
    return { kind: "expire" };
  }

  return { kind: "none" };
}
