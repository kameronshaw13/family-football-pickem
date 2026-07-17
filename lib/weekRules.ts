import type { Game, Pick, WeekRule } from "@/lib/types";

export function getWeekRule(week: number): WeekRule {
  if (week <= 1) {
    return { week, label: `Week ${week}`, phase: "opening", regularTotal: 3, cfbMinimum: 3, nflMinimum: 0, underdogTotal: 1, perfectBonus: false };
  }
  if (week === 2) {
    return { week, label: "Week 2", phase: "college", regularTotal: 5, cfbMinimum: 5, nflMinimum: 0, underdogTotal: 1, perfectBonus: true };
  }
  if (week >= 16) {
    return { week, label: `Week ${week}`, phase: "nfl", regularTotal: 2, cfbMinimum: 0, nflMinimum: 2, underdogTotal: 1, perfectBonus: false };
  }
  return { week, label: `Week ${week}`, phase: "mixed", regularTotal: 5, cfbMinimum: 1, nflMinimum: 1, underdogTotal: 1, perfectBonus: true };
}

export function countRegularByLeague(picks: Pick[], games: Game[]) {
  const regular = picks.filter((p) => p.pick_type === "regular");
  let cfb = 0;
  let nfl = 0;
  for (const pick of regular) {
    const game = games.find((g) => g.id === pick.game_id) || pick.game;
    if (game?.league === "CFB") cfb++;
    if (game?.league === "NFL") nfl++;
  }
  return { total: regular.length, cfb, nfl };
}
