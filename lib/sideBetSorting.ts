import type { SideBet } from "./types.ts";

export type SideBetGameFilter = "all" | "upcoming" | "completed";
/** Ordering and grouping of side bets; independent of React rendering. */
export function sideBetGameCompleted(bet: SideBet) {
  const game = bet.game;
  return bet.status === "settled" || Boolean(game?.live_completed) ||
    Boolean(game && game.final_home_score != null && game.final_away_score != null);
}

export function sideBetMatchesGameFilter(bet: SideBet, filter: SideBetGameFilter) {
  if (filter === "all") return true;
  const completed = sideBetGameCompleted(bet);
  return filter === "completed" ? completed : !completed;
}

export function sideBetKickoffTime(bet: SideBet) {
  const kickoff = bet.game?.commence_time ? new Date(bet.game.commence_time).getTime() : Number.POSITIVE_INFINITY;
  return Number.isFinite(kickoff) ? kickoff : Number.POSITIVE_INFINITY;
}

export function sideBetCompletionTime(bet: SideBet) {
  const updated = new Date(bet.updated_at || bet.accepted_at || bet.created_at).getTime();
  return Number.isFinite(updated) ? updated : 0;
}

export function sideBetCreatedTime(bet: SideBet) {
  const created = new Date(bet.created_at).getTime();
  return Number.isFinite(created) ? created : 0;
}

export function sortSideBetsByGameStatus(a: SideBet, b: SideBet) {
  const aCompleted = sideBetGameCompleted(a);
  const bCompleted = sideBetGameCompleted(b);
  if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;
  if (aCompleted) return sideBetCompletionTime(b) - sideBetCompletionTime(a);
  const kickoffDiff = sideBetKickoffTime(a) - sideBetKickoffTime(b);
  if (kickoffDiff !== 0) return kickoffDiff;
  return sideBetCreatedTime(a) - sideBetCreatedTime(b);
}

export function sortSideBetsGroupedByGame(bets: SideBet[]) {
  const groups = new Map<string, SideBet[]>();
  bets.forEach((bet) => {
    const key = bet.game_id || bet.game?.id || bet.id;
    const group = groups.get(key);
    if (group) group.push(bet);
    else groups.set(key, [bet]);
  });

  const orderedGroups = Array.from(groups.values()).sort((a, b) => {
    const aFirst = a[0];
    const bFirst = b[0];
    const aCompleted = a.some(sideBetGameCompleted);
    const bCompleted = b.some(sideBetGameCompleted);
    if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;

    if (aCompleted) {
      const aCompletion = Math.max(...a.map(sideBetCompletionTime));
      const bCompletion = Math.max(...b.map(sideBetCompletionTime));
      if (aCompletion !== bCompletion) return bCompletion - aCompletion;
    } else {
      const kickoffDiff = sideBetKickoffTime(aFirst) - sideBetKickoffTime(bFirst);
      if (kickoffDiff !== 0) return kickoffDiff;
    }

    const aFirstCreated = Math.min(...a.map(sideBetCreatedTime));
    const bFirstCreated = Math.min(...b.map(sideBetCreatedTime));
    if (aFirstCreated !== bFirstCreated) return aFirstCreated - bFirstCreated;
    return String(aFirst.game_id || aFirst.id).localeCompare(String(bFirst.game_id || bFirst.id));
  });

  return orderedGroups.flatMap((group) =>
    [...group].sort((a, b) => {
      const createdDiff = sideBetCreatedTime(a) - sideBetCreatedTime(b);
      if (createdDiff !== 0) return createdDiff;
      return String(a.id).localeCompare(String(b.id));
    })
  );
}

