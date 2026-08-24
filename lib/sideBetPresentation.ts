import type { SideBet } from "./types";

export type SideBetViewMode = "received" | "sent";

export function sideBetsForView(bets: SideBet[], userId: string, mode: SideBetViewMode) {
  return bets.filter((bet) => {
    return mode === "sent"
      ? bet.creator_id === userId
      : bet.creator_id !== userId && Boolean(bet.targets?.some((target) => target.recipient_id === userId));
  });
}

export function sideBetOfferIsPending(bet: SideBet, userId: string, mode: SideBetViewMode) {
  if (bet.status !== "open") return false;
  if (mode === "sent") return Boolean(bet.targets?.some((target) => target.response === "pending"));
  return bet.targets?.find((target) => target.recipient_id === userId)?.response === "pending";
}

export function sideBetPerspective(bet: SideBet, mode: SideBetViewMode) {
  return mode === "sent"
    ? { team: bet.creator_team, spread: Number(bet.creator_spread) }
    : { team: bet.offered_team, spread: Number(bet.offered_spread) };
}

export function sideBetLedgerPerspective(bet: SideBet, userId: string) {
  const userTeam = bet.creator_id === userId
    ? bet.creator_team
    : bet.accepted_by === userId
      ? bet.offered_team
      : null;
  const favoriteTeam = Number(bet.creator_spread) < 0
    ? bet.creator_team
    : Number(bet.offered_spread) < 0
      ? bet.offered_team
      : bet.creator_team;
  const team = userTeam || favoriteTeam;
  return {
    team,
    spread: Number(team === bet.creator_team ? bet.creator_spread : bet.offered_spread),
    involvesUser: Boolean(userTeam)
  };
}

export function sideBetBettorForTeam(bet: SideBet, team: string) {
  if (team === bet.creator_team) return { id: bet.creator_id, name: bet.creator?.display_name || "Player" };
  return { id: bet.accepted_by || "", name: bet.accepted_by_profile?.display_name || "Opponent" };
}
