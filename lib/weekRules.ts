import type { Game, Pick, WeekRule } from "@/lib/types";

export function getWeekRule(week: number): WeekRule {
  return { week, label: `Week ${week}`, regularTotal: 5, cfbMinimum: 1, nflMinimum: 1, underdogTotal: 1 };
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
