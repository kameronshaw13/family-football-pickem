export type RankedStanding = { user_id: string; rank?: number };

export function winnerTakeAllSettlement<T extends RankedStanding>(standings: T[], totalAmount: number) {
  const amounts = new Map(standings.map((row) => [row.user_id, 0]));
  const notes = new Map<string, string>();
  const pot = Math.max(0, Number(totalAmount) || 0);
  if (standings.length < 2 || pot <= 0) return { amounts, notes };
  const winners = standings.filter((row) => row.rank === standings[0]?.rank);
  if (winners.length === standings.length) {
    standings.forEach((row) => notes.set(row.user_id, "All players tied · no payment"));
    return { amounts, notes };
  }
  const winnerIds = new Set(winners.map((winner) => winner.user_id));
  const losers = standings.filter((row) => !winnerIds.has(row.user_id));
  const winnerShare = pot / winners.length;
  const loserShare = pot / losers.length;
  winners.forEach((row) => {
    amounts.set(row.user_id, winnerShare);
    notes.set(row.user_id, winners.length > 1 ? "Split winner-take-all" : "Winner-take-all");
  });
  losers.forEach((row) => {
    amounts.set(row.user_id, -loserShare);
    notes.set(row.user_id, "Winner-take-all contribution");
  });
  return { amounts, notes };
}

export function rankedPayoutSettlement<T extends RankedStanding>(standings: T[], positionPayouts: number[], label: string) {
  const amounts = new Map(standings.map((row) => [row.user_id, 0]));
  const notes = new Map<string, string>();
  if (!standings.length) return { amounts, notes };
  let index = 0;
  while (index < standings.length) {
    const rank = standings[index].rank;
    let end = index + 1;
    while (end < standings.length && standings[end].rank === rank) end += 1;
    const occupied = positionPayouts.slice(index, end);
    const sharedAmount = occupied.length ? occupied.reduce((sum, value) => sum + Number(value || 0), 0) / occupied.length : 0;
    const tie = end - index > 1;
    for (let cursor = index; cursor < end; cursor += 1) {
      amounts.set(standings[cursor].user_id, sharedAmount);
      notes.set(standings[cursor].user_id, `${label}${tie ? " · tie split" : ""}`);
    }
    index = end;
  }
  return { amounts, notes };
}
