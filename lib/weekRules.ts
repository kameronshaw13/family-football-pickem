import type { Game, Pick, WeekRule } from "@/lib/types";

export function getWeekRule(week: number): WeekRule {
  // Odds API/our board currently labels the first playable college slate as Week 1.
  // Treat Week 1 like the old "Week 0" rules: 3 college picks + 1 dog.
  if (week <= 1) {
    return { week, label: `Week ${week}`, regularTotal: 3, cfbRequired: 3, nflRequired: 0, underdogTotal: 1 };
  }
  // The next slate is college-only: 5 college picks + 1 dog.
  if (week === 2) {
    return { week, label: "Week 2", regularTotal: 5, cfbRequired: 5, nflRequired: 0, underdogTotal: 1 };
  }
  // After NFL begins: 3 college, 2 NFL, + 1 dog.
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
