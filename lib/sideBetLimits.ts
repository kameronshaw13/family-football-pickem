export const MAX_SIDE_BETS_PER_WEEK = 3;
export const MAX_SIDE_BET_AMOUNT = 20;

type AcceptedSideBet = {
  creator_id: string;
  accepted_by: string | null;
};

type SideBetLimitTarget = {
  recipient_id: string;
  response: string;
};

type SideBetForLimit = AcceptedSideBet & {
  id?: string;
  status: string;
  targets?: SideBetLimitTarget[] | null;
};

export function acceptedSideBetCounts(rows: AcceptedSideBet[], playerIds: string[] = []) {
  const counts: Record<string, number> = Object.fromEntries(playerIds.map((id) => [id, 0]));

  for (const row of rows) {
    counts[row.creator_id] = (counts[row.creator_id] || 0) + 1;
    if (row.accepted_by) counts[row.accepted_by] = (counts[row.accepted_by] || 0) + 1;
  }

  return counts;
}

export function sideBetSlotCounts(rows: SideBetForLimit[], playerIds: string[] = [], excludeSideBetId?: string) {
  const counts: Record<string, number> = Object.fromEntries(playerIds.map((id) => [id, 0]));

  for (const row of rows) {
    if (excludeSideBetId && row.id === excludeSideBetId) continue;

    if (["accepted", "settled"].includes(row.status)) {
      counts[row.creator_id] = (counts[row.creator_id] || 0) + 1;
      if (row.accepted_by) counts[row.accepted_by] = (counts[row.accepted_by] || 0) + 1;
      continue;
    }

    if (row.status !== "open") continue;
    const pendingTargets = (row.targets || []).filter((target) => target.response === "pending");
    if (!pendingTargets.length) continue;

    counts[row.creator_id] = (counts[row.creator_id] || 0) + 1;
    for (const target of pendingTargets) {
      counts[target.recipient_id] = (counts[target.recipient_id] || 0) + 1;
    }
  }

  return counts;
}

export async function getAcceptedSideBetCounts(supabase: any, week: number, playerIds: string[] = []) {
  const { data, error } = await supabase
    .from("side_bets")
    .select("creator_id,accepted_by")
    .eq("week", week)
    .in("status", ["accepted", "settled"]);

  if (error) throw new Error(error.message);
  return acceptedSideBetCounts(data || [], playerIds);
}

export async function getSideBetSlotCounts(supabase: any, week: number, playerIds: string[] = [], excludeSideBetId?: string) {
  const { data, error } = await supabase
    .from("side_bets")
    .select("id,creator_id,accepted_by,status,targets:side_bet_targets(recipient_id,response)")
    .eq("week", week)
    .in("status", ["open", "accepted", "settled"]);

  if (error) throw new Error(error.message);
  return sideBetSlotCounts(data || [], playerIds, excludeSideBetId);
}

export async function closeOpenOffersForCappedPlayer(supabase: any, playerId: string, week: number, nowIso: string) {
  const [{ data: outgoing, error: outgoingError }, { data: pendingTargets, error: targetError }] = await Promise.all([
    supabase.from("side_bets").select("id").eq("creator_id", playerId).eq("week", week).eq("status", "open"),
    supabase.from("side_bet_targets").select("side_bet_id").eq("recipient_id", playerId).eq("response", "pending")
  ]);

  if (outgoingError) throw new Error(outgoingError.message);
  if (targetError) throw new Error(targetError.message);

  const outgoingIds = (outgoing || []).map((bet: { id: string }) => bet.id);
  if (outgoingIds.length) {
    const { error } = await supabase
      .from("side_bets")
      .update({ status: "cancelled", updated_at: nowIso })
      .in("id", outgoingIds)
      .eq("status", "open");
    if (error) throw new Error(error.message);

    const { error: closeTargetError } = await supabase
      .from("side_bet_targets")
      .update({ response: "closed", responded_at: nowIso })
      .in("side_bet_id", outgoingIds)
      .eq("response", "pending");
    if (closeTargetError) throw new Error(closeTargetError.message);
  }

  const candidateIncomingIds = Array.from(new Set((pendingTargets || []).map((target: { side_bet_id: string }) => target.side_bet_id)));
  if (!candidateIncomingIds.length) return { outgoingIds, incomingIds: [] as string[] };

  const { data: incoming, error: incomingError } = await supabase
    .from("side_bets")
    .select("id")
    .in("id", candidateIncomingIds)
    .eq("week", week)
    .eq("status", "open");
  if (incomingError) throw new Error(incomingError.message);

  const incomingIds = (incoming || []).map((bet: { id: string }) => bet.id);
  if (!incomingIds.length) return { outgoingIds, incomingIds };

  const { error: declineError } = await supabase
    .from("side_bet_targets")
    .update({ response: "declined", responded_at: nowIso })
    .eq("recipient_id", playerId)
    .eq("response", "pending")
    .in("side_bet_id", incomingIds);
  if (declineError) throw new Error(declineError.message);

  for (const sideBetId of incomingIds) {
    const { count, error: pendingError } = await supabase
      .from("side_bet_targets")
      .select("recipient_id", { count: "exact", head: true })
      .eq("side_bet_id", sideBetId)
      .eq("response", "pending");
    if (pendingError) throw new Error(pendingError.message);

    if (!count) {
      const { error: sideBetError } = await supabase
        .from("side_bets")
        .update({ status: "declined", updated_at: nowIso })
        .eq("id", sideBetId)
        .eq("status", "open");
      if (sideBetError) throw new Error(sideBetError.message);
    }
  }
  return { outgoingIds, incomingIds };
}
