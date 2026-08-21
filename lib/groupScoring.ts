import type { Pick as FootballPick, ProfileSummary, Standing } from "@/lib/types";
import type { WeeklyStanding } from "@/lib/weeklyBank";
import { computeWeeklyStandings } from "@/lib/weeklyBank";
export { rankedPayoutSettlement, winnerTakeAllSettlement } from "@/lib/settlementMath";

export type GroupStanding = WeeklyStanding & { points?: number };

export function isConfidenceMode(rules: any) {
  return rules?.scoring?.mode === "confidence";
}

export function computeGroupStandings(profiles: ProfileSummary[], picks: FootballPick[], rules: any): GroupStanding[] {
  if (!isConfidenceMode(rules)) return computeWeeklyStandings(profiles, picks);
  const pushMultiplier = Number.isFinite(Number(rules?.scoring?.pushMultiplier)) ? Number(rules.scoring.pushMultiplier) : 0.5;

  const map = new Map<string, GroupStanding>();
  for (const profile of profiles) {
    map.set(profile.id, {
      user_id: profile.id,
      display_name: profile.display_name,
      wins: 0,
      losses: 0,
      pushes: 0,
      win_pct: 0,
      rank: 0,
      points: 0
    });
  }

  for (const pick of picks) {
    const row = map.get(pick.user_id);
    if (!row || pick.status !== "locked" || pick.result === "pending") continue;
    if (pick.pick_type === "regular") {
      if (pick.result === "win") {
        row.points = Number(row.points || 0) + Number((pick as FootballPick & { confidence_points?: number | null }).confidence_points || 0);
        row.wins += 1;
      } else if (pick.result === "loss") row.losses += 1;
      else if (pick.result === "push") {
        row.points = Number(row.points || 0) + Number((pick as FootballPick & { confidence_points?: number | null }).confidence_points || 0) * pushMultiplier;
        row.pushes += 1;
      }
      continue;
    }
    if (pick.pick_type === "underdog" && pick.result === "win") {
      row.points = Number(row.points || 0) + Number(pick.underdog_win_value || 0);
    }
  }

  const sorted = Array.from(map.values()).map((row) => ({
    ...row,
    win_pct: row.wins + row.losses === 0 ? 0 : row.wins / (row.wins + row.losses)
  })).sort((a, b) =>
    Number(b.points || 0) - Number(a.points || 0) ||
    b.wins - a.wins ||
    a.losses - b.losses ||
    b.pushes - a.pushes ||
    a.display_name.localeCompare(b.display_name)
  );

  let rank = 1;
  return sorted.map((row, index) => {
    if (index > 0) {
      const prior = sorted[index - 1];
      const tied = Number(row.points || 0) === Number(prior.points || 0) && row.wins === prior.wins && row.losses === prior.losses && row.pushes === prior.pushes;
      if (!tied) rank = index + 1;
    }
    return { ...row, rank };
  });
}

export function standingPoints(row: Standing | GroupStanding) {
  return Number((row as GroupStanding).points || 0);
}
