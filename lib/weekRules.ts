import type { Game, Pick, WeekRule } from "@/lib/types";

export function getWeekRule(week: number): WeekRule {
  if (week === 0) {
    return { week, label: "Week 0", regularTotal: 3, cfbRequired: 3, nflRequired: 0, underdogTotal: 1 };
  }
  if (week === 1) {
    return { week, label: "Week 1", regularTotal: 5, cfbRequired: 5, nflRequired: 0, underdogTotal: 1 };
  }
  return { week, label: `Week ${week}`, regularTotal: 5, cfbRequired: 3, nflRequired: 2, underdogTotal: 1 };
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
