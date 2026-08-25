import type { SideBet } from "./types";

export type SideBetViewMode = "received" | "sent";
export type SideBetResponseTone = "accepted" | "declined" | "pending";
export type SideBetResponseSummary = {
  full: string;
  compact: string;
  tone: SideBetResponseTone;
};

function targetName(target: NonNullable<SideBet["targets"]>[number]) {
  return target.recipient?.display_name || "Player";
}

function naturalNameList(names: string[]) {
  if (names.length <= 1) return names[0] || "Player";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function compactNameList(names: string[]) {
  if (names.length <= 2) return naturalNameList(names);
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

function namedSummary(names: string[], prefix: string, suffix = ""): Pick<SideBetResponseSummary, "full" | "compact"> {
  const end = suffix ? ` ${suffix}` : "";
  return {
    full: `${prefix}${naturalNameList(names)}${end}`,
    compact: `${prefix}${compactNameList(names)}${end}`
  };
}

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

export function sideBetResponseSummary(bet: SideBet, userId: string, mode: SideBetViewMode): SideBetResponseSummary {
  const targets = bet.targets || [];
  const currentTarget = targets.find((target) => target.recipient_id === userId);
  const acceptedTarget = targets.find((target) => target.recipient_id === bet.accepted_by || target.response === "accepted");
  const creatorName = bet.creator?.display_name || "A player";

  if (bet.status === "accepted" || acceptedTarget) {
    const acceptedByCurrentUser = (bet.accepted_by || acceptedTarget?.recipient_id) === userId;
    const name = acceptedByCurrentUser
      ? "You"
      : acceptedTarget?.recipient?.display_name || bet.accepted_by_profile?.display_name || "A player";
    return { full: `${name} accepted`, compact: `${name} accepted`, tone: "accepted" };
  }

  if (bet.status === "cancelled") {
    const name = bet.creator_id === userId ? "You" : creatorName;
    return { full: `${name} cancelled`, compact: `${name} cancelled`, tone: "declined" };
  }

  if (bet.status === "expired") {
    return { full: "Offer expired", compact: "Offer expired", tone: "declined" };
  }

  if (mode === "received") {
    if (currentTarget?.response === "declined") {
      return { full: "You declined", compact: "You declined", tone: "declined" };
    }
    if (currentTarget?.response === "pending" && bet.status === "open") {
      return { full: `${creatorName} offered to you`, compact: `${creatorName} offered to you`, tone: "pending" };
    }
    return { full: "Offer closed", compact: "Offer closed", tone: "declined" };
  }

  const pendingNames = targets.filter((target) => target.response === "pending").map(targetName);
  if (bet.status === "open" && pendingNames.length) {
    return { ...namedSummary(pendingNames, "Offered to "), tone: "pending" };
  }

  const declinedNames = targets.filter((target) => target.response === "declined").map(targetName);
  if (declinedNames.length) {
    return { ...namedSummary(declinedNames, "", "declined"), tone: "declined" };
  }

  return { full: "Offer declined", compact: "Offer declined", tone: "declined" };
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
