import type { Pick as FootballPick, ProfileSummary, Standing } from "@/lib/types";

export type WeeklyStanding = Standing & { rank: number };
export type WeeklySettlement = {
  perfect: boolean;
  amounts: Map<string, number>;
  notes: Map<string, string>;
};

function tied(a: Standing, b: Standing) {
  return a.win_pct === b.win_pct && a.wins === b.wins && a.losses === b.losses;
}

export function computeWeeklyStandings(profiles: ProfileSummary[], picks: FootballPick[]): WeeklyStanding[] {
  const map = new Map<string, WeeklyStanding>();
  for (const profile of profiles) {
    map.set(profile.id, { user_id: profile.id, display_name: profile.display_name, wins: 0, losses: 0, pushes: 0, win_pct: 0, rank: 0 });
  }
  for (const pick of picks) {
    const row = map.get(pick.user_id);
    if (!row || pick.status !== "locked") continue;
    if (pick.result === "win") row.wins += pick.pick_type === "underdog" ? Number(pick.underdog_win_value || 1) : 1;
    if (pick.result === "loss") row.losses += 1;
    if (pick.result === "push") row.pushes += 1;
  }

  const sorted = Array.from(map.values()).map((row) => ({
    ...row,
    win_pct: row.wins + row.losses === 0 ? 0 : row.wins / (row.wins + row.losses)
  }));
  sorted.sort((a, b) => (b.win_pct - a.win_pct) || (b.wins - a.wins) || (a.losses - b.losses) || a.display_name.localeCompare(b.display_name));

  let rank = 1;
  return sorted.map((row, index) => {
    if (index > 0 && !tied(row, sorted[index - 1])) rank = index + 1;
    return { ...row, rank };
  });
}

export function computeWeeklySettlement(standings: WeeklyStanding[], allowPerfectBonus = true): WeeklySettlement {
  const amounts = new Map(standings.map((row) => [row.user_id, 0]));
  const notes = new Map<string, string>();
  if (standings.length !== 3) throw new Error("Weekly settlement requires exactly three players.");

  const top = standings.filter((row) => tied(row, standings[0]));
  const perfect = allowPerfectBonus && standings[0].losses === 0 && standings[0].wins >= 5;
  const multiplier = perfect ? 2 : 1;

  if (top.length === 3) {
    for (const row of standings) notes.set(row.user_id, `Three-way tie${perfect ? " · perfect week" : ""}`);
    return { perfect, amounts, notes };
  }

  if (top.length === 2) {
    const last = standings[2];
    const payment = 20 * multiplier;
    amounts.set(last.user_id, -payment);
    notes.set(last.user_id, `Tied-first payout${perfect ? " · doubled" : ""}`);
    for (const winner of top) {
      amounts.set(winner.user_id, payment / 2);
      notes.set(winner.user_id, `Split first${perfect ? " · perfect week" : ""}`);
    }
    return { perfect, amounts, notes };
  }

  const winner = standings[0];
  const bottomTied = tied(standings[1], standings[2]);
  if (bottomTied) {
    const payment = 15 * multiplier;
    amounts.set(winner.user_id, payment * 2);
    notes.set(winner.user_id, `Week winner${perfect ? " · perfect week" : ""}`);
    for (const loser of standings.slice(1)) {
      amounts.set(loser.user_id, -payment);
      notes.set(loser.user_id, `Tied for last${perfect ? " · doubled" : ""}`);
    }
    return { perfect, amounts, notes };
  }

  amounts.set(winner.user_id, 30 * multiplier);
  amounts.set(standings[1].user_id, -10 * multiplier);
  amounts.set(standings[2].user_id, -20 * multiplier);
  notes.set(winner.user_id, `Week winner${perfect ? " · perfect week" : ""}`);
  notes.set(standings[1].user_id, `Second place${perfect ? " · doubled" : ""}`);
  notes.set(standings[2].user_id, `Last place${perfect ? " · doubled" : ""}`);
  return { perfect, amounts, notes };
}
