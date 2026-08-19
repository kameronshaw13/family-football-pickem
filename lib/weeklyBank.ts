import type { Pick as FootballPick, ProfileSummary, Standing } from "@/lib/types";

export type WeeklyStanding = Standing & { rank: number };
export type WeeklySettlement = { perfect: boolean; amounts: Map<string, number>; notes: Map<string, string> };

function tied(a: Standing, b: Standing) {
  return a.win_pct === b.win_pct && a.wins === b.wins && a.losses === b.losses;
}

export function computeWeeklyStandings(profiles: ProfileSummary[], picks: FootballPick[]): WeeklyStanding[] {
  const map = new Map<string, WeeklyStanding>();
  for (const profile of profiles) map.set(profile.id, { user_id: profile.id, display_name: profile.display_name, wins: 0, losses: 0, pushes: 0, win_pct: 0, rank: 0 });
  for (const pick of picks) {
    const row = map.get(pick.user_id);
    if (!row || pick.status !== "locked") continue;
    if (pick.result === "win") row.wins += pick.pick_type === "underdog" ? Number(pick.underdog_win_value || 1) : 1;
    if (pick.pick_type === "regular" && pick.result === "loss") row.losses += 1;
    if (pick.pick_type === "regular" && pick.result === "push") row.pushes += 1;
  }
  const sorted = Array.from(map.values()).map((row) => ({ ...row, win_pct: row.wins + row.losses === 0 ? 0 : row.wins / (row.wins + row.losses) }));
  sorted.sort((a, b) => (b.win_pct - a.win_pct) || (b.wins - a.wins) || (a.losses - b.losses) || a.display_name.localeCompare(b.display_name));
  let rank = 1;
  return sorted.map((row, index) => { if (index > 0 && !tied(row, sorted[index - 1])) rank = index + 1; return { ...row, rank }; });
}

export function computeWeeklySettlement(standings: WeeklyStanding[], allowPerfectBonus = true): WeeklySettlement {
  const amounts = new Map(standings.map((row) => [row.user_id, 0]));
  const notes = new Map<string, string>();
  if (standings.length < 2) return { perfect: false, amounts, notes };

  const top = standings.filter((row) => tied(row, standings[0]));
  const bottom = standings.filter((row) => tied(row, standings[standings.length - 1]));
  const perfect = allowPerfectBonus && standings[0].losses === 0 && standings[0].wins >= 5;
  const multiplier = perfect ? 2 : 1;

  if (top.length === standings.length) {
    for (const row of standings) notes.set(row.user_id, `All players tied${perfect ? " · perfect week" : ""}`);
    return { perfect, amounts, notes };
  }

  if (top.length > 1) {
    const totalPayment = 20 * multiplier;
    const winnerShare = totalPayment / top.length;
    const loserShare = totalPayment / bottom.length;
    for (const winner of top) {
      amounts.set(winner.user_id, winnerShare);
      notes.set(winner.user_id, `Split first${perfect ? " · perfect week" : ""}`);
    }
    for (const loser of bottom) {
      amounts.set(loser.user_id, -loserShare);
      notes.set(loser.user_id, `Last-place payment${perfect ? " · doubled" : ""}`);
    }
    return { perfect, amounts, notes };
  }

  const winner = standings[0];
  if (bottom.length > 1) {
    const paymentEach = 15 * multiplier;
    amounts.set(winner.user_id, paymentEach * bottom.length);
    notes.set(winner.user_id, `Week winner${perfect ? " · perfect week" : ""}`);
    for (const loser of bottom) {
      amounts.set(loser.user_id, -paymentEach);
      notes.set(loser.user_id, `Tied for last${perfect ? " · doubled" : ""}`);
    }
    return { perfect, amounts, notes };
  }

  const last = standings[standings.length - 1];
  const secondRank = standings.find((row) => row.rank > standings[0].rank && row.user_id !== last.user_id)?.rank;
  const secondGroup = secondRank == null ? [] : standings.filter((row) => row.rank === secondRank && row.user_id !== last.user_id);
  const secondPool = 10 * multiplier;
  const lastPayment = 20 * multiplier;
  amounts.set(winner.user_id, secondPool + lastPayment);
  notes.set(winner.user_id, `Week winner${perfect ? " · perfect week" : ""}`);
  amounts.set(last.user_id, -lastPayment);
  notes.set(last.user_id, `Last place${perfect ? " · doubled" : ""}`);
  if (secondGroup.length) {
    const share = secondPool / secondGroup.length;
    for (const second of secondGroup) {
      amounts.set(second.user_id, -share);
      notes.set(second.user_id, `Second-place payment${secondGroup.length > 1 ? " split" : ""}${perfect ? " · doubled" : ""}`);
    }
  }
  return { perfect, amounts, notes };
}
