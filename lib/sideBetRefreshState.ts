import type { Game, SideBet } from "./types.ts";

/** Deterministic fingerprints used to avoid needless updates during polling. */
export function sideBetSyncSignature(bets: SideBet[] = []) {
  return bets.map(bet => ({
    id: bet.id, status: bet.status, acceptedBy: bet.accepted_by,
    winnerId: bet.winner_id, result: bet.result, updatedAt: bet.updated_at,
    targets: (bet.targets || []).map(target =>
      `${target.recipient_id}:${target.response}:${target.responded_at || ""}`).sort()
  })).sort((a, b) => a.id.localeCompare(b.id)).map(bet => JSON.stringify(bet)).join("|");
}

export function sideBetLedgerSignature(bets: SideBet[] = []) {
  return bets.map(bet => `${bet.id}:${bet.status}:${bet.result}:${bet.winner_id || ""}:${bet.updated_at}`).sort().join("|");
}

/** Old polling requests cannot supersede mutations or a newer response. */
export function canApplySideBetSnapshot(requestId: number, latestRequested: number, latestApplied: number) {
  return requestId >= latestRequested && requestId >= latestApplied;
}

export type SideBetRefreshSnapshot = {
  sideBets: SideBet[];
  sideBetSlotCounts?: Record<string, number>;
};

export function reconcileSideBetSnapshot<T extends {
  sideBets: SideBet[];
  sideBetSlotCounts: Record<string, number>;
  games: Game[];
}>(current: T, payload: SideBetRefreshSnapshot): T {
  const nextSideBets = payload.sideBets.map(bet => ({
    ...bet, game: current.games.find(game => game.id === bet.game_id) || bet.game
  }));
  const nextSlotCounts = payload.sideBetSlotCounts || current.sideBetSlotCounts;
  if (sideBetSyncSignature(current.sideBets) === sideBetSyncSignature(nextSideBets) &&
      JSON.stringify(current.sideBetSlotCounts) === JSON.stringify(nextSlotCounts)) return current;
  return { ...current, sideBets: nextSideBets, sideBetSlotCounts: nextSlotCounts };
}

/** Only a live-game acceptance includes scores visible to the initiating user. */
export function sideBetRequestWithVisibleScores<T extends { action?: string; sideBetId?: string }>(
  body: T,
  current: { sideBets: SideBet[]; games: Game[] } | null | undefined
): T & { visibleLiveHomeScore?: number; visibleLiveAwayScore?: number } {
  const liveBet = body.action === "accept" && body.sideBetId
    ? current?.sideBets.find(bet => bet.id === body.sideBetId) : null;
  const liveGame = liveBet?.offer_phase === "live"
    ? current?.games.find(game => game.id === liveBet.game_id) : null;
  return liveGame ? {
    ...body,
    visibleLiveHomeScore: liveGame.live_home_score ?? undefined,
    visibleLiveAwayScore: liveGame.live_away_score ?? undefined
  } : body;
}
