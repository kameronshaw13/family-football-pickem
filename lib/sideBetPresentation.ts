import type { SideBet } from "./types";

export type SideBetViewMode = "received" | "sent";
export type SideBetResponseTone = "accepted" | "declined" | "pending";
export type SideBetResponseSummary = {
  subjectFull: string;
  subjectCompact: string;
  action: "Accepted" | "Cancelled" | "Closed" | "Declined" | "Expired" | "Offered";
  recipientFull?: string;
  recipientCompact?: string;
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
  if (names.length <= 1) return naturalNameList(names);
  if (names.length === 2) return `${names[0]} + ${names[1]}`;
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

export function sideBetsForView(bets: SideBet[], userId: string, mode: SideBetViewMode) {
  return bets.filter((bet) => {
    if (mode === "sent") return bet.creator_id === userId;
    if (bet.creator_id === userId) return false;

    // Once an offer has been accepted, it becomes a two-person bet. Other
    // original recipients should no longer see that accepted/settled bet in
    // their Offer History just because they were initially targeted.
    if (bet.accepted_by) return bet.accepted_by === userId;

    return Boolean(bet.targets?.some((target) => target.recipient_id === userId));
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
    return { subjectFull: name, subjectCompact: name, action: "Accepted", tone: "accepted" };
  }

  if (bet.status === "cancelled") {
    const name = bet.creator_id === userId ? "You" : creatorName;
    return { subjectFull: name, subjectCompact: name, action: "Cancelled", tone: "declined" };
  }

  if (bet.status === "expired") {
    return { subjectFull: "Offer", subjectCompact: "Offer", action: "Expired", tone: "declined" };
  }

  if (mode === "received") {
    if (currentTarget?.response === "declined") {
      return { subjectFull: "You", subjectCompact: "You", action: "Declined", tone: "declined" };
    }
    if (currentTarget?.response === "pending" && bet.status === "open") {
      return { subjectFull: creatorName, subjectCompact: creatorName, action: "Offered", tone: "pending" };
    }
    return { subjectFull: "Offer", subjectCompact: "Offer", action: "Closed", tone: "declined" };
  }

  const pendingNames = targets.filter((target) => target.response === "pending").map(targetName);
  if (bet.status === "open" && pendingNames.length) {
    return {
      subjectFull: "You",
      subjectCompact: "You",
      action: "Offered",
      recipientFull: naturalNameList(pendingNames),
      recipientCompact: compactNameList(pendingNames),
      tone: "pending"
    };
  }

  const declinedNames = targets.filter((target) => target.response === "declined").map(targetName);
  if (declinedNames.length) {
    return {
      subjectFull: naturalNameList(declinedNames),
      subjectCompact: compactNameList(declinedNames),
      action: "Declined",
      tone: "declined"
    };
  }

  return { subjectFull: "Offer", subjectCompact: "Offer", action: "Declined", tone: "declined" };
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
