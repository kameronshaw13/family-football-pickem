import type { Game, Pick, Profile } from "./types";
import { getGameLockTime } from "./lockRules";

const now = new Date();
const iso = (offsetDays: number, hour: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const makeGame = (id: string, week: number, league: "NFL" | "CFB", away: string, home: string, dayOffset: number, hour: number, spreadTeam: string, spread: number): Game => {
  const commence_time = iso(dayOffset, hour);
  return {
    id, week, league, away_team: away, home_team: home, commence_time,
    current_spread_team: spreadTeam, current_spread: spread, current_bookmaker: "DraftKings",
    lock_time: getGameLockTime(commence_time).toISOString(), is_locked: new Date() >= getGameLockTime(commence_time),
    final_home_score: null, final_away_score: null
  };
};

export const demoProfiles: Profile[] = [
  { id: "kameron", display_name: "Kameron", is_admin: true },
  { id: "dad", display_name: "Dad", is_admin: false },
  { id: "brother", display_name: "Brother", is_admin: false }
];

export const demoGames: Game[] = [
  makeGame("g1", 1, "CFB", "Oklahoma", "Texas", 2, 19, "Texas", -3.5),
  makeGame("g2", 1, "CFB", "Kansas State", "Oklahoma State", 3, 18, "Kansas State", -1.5),
  makeGame("g3", 1, "CFB", "Alabama", "Georgia", 4, 19, "Georgia", -2.5),
  makeGame("g4", 1, "CFB", "Michigan", "Ohio State", 5, 11, "Ohio State", -6.5),
  makeGame("g5", 1, "NFL", "Chiefs", "Broncos", 6, 12, "Chiefs", -4.5),
  makeGame("g6", 1, "NFL", "Ravens", "Bengals", 7, 19, "Ravens", -2.5),
  makeGame("g7", 1, "NFL", "Cowboys", "Eagles", 8, 19, "Eagles", -3)
];

export const demoPicks: Pick[] = [];
