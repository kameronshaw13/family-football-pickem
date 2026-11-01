import { scoreFromCompetitor } from "./espnSchedule.ts";
import { normalizeSpreadForSelectedTeam } from "./spreads.ts";

export type BasketballResult = {
  id: string; date: string; opponentId: string; opponent: string; opponentLogo: string | null;
  home: boolean; neutralSite: boolean; teamPoints: number; opponentPoints: number;
  result: "W" | "L" | "P"; spread: number | null; cover: number | null; ats: "W" | "L" | "P" | null;
};
export type BasketballForm = {
  id: string; name: string; logo: string | null; games: BasketballResult[];
  record: { wins: number; losses: number }; points: number | null; allowed: number | null; margin: number | null;
  ats: { wins: number; losses: number; pushes: number; margin: number | null };
};
type SavedLine = { id: string; espn_event_id?: string | null; home_team: string; away_team: string; current_spread_team: string | null; current_spread: number | null };

/** Completed games strictly before this matchup. Missing scores never become zero. */
export function basketballResults(events: any[], teamId: string, cutoff: number, lines: SavedLine[] = []): BasketballResult[] {
  const lineByEvent = new Map<string, SavedLine>();
  for (const line of lines) {
    if (!line.espn_event_id) continue;
    const prior = lineByEvent.get(String(line.espn_event_id));
    if (!prior || (prior.current_spread == null && line.current_spread != null)) lineByEvent.set(String(line.espn_event_id), line);
  }
  const unique = new Map<string, BasketballResult>();
  for (const event of events) {
    const competition = event.competitions?.[0];
    const date = competition?.date || event.date;
    if (!competition?.status?.type?.completed || !(Date.parse(date) < cutoff)) continue;
    // Exclude preseason/exhibitions while retaining the postseason.
    if (Number(event.seasonType?.type ?? event.season?.type) === 1) continue;
    const team = competition.competitors?.find((row: any) => String(row.team?.id) === teamId);
    const opponent = competition.competitors?.find((row: any) => String(row.team?.id) !== teamId);
    if (!team || !opponent) continue;
    const teamPoints = scoreFromCompetitor(team), opponentPoints = scoreFromCompetitor(opponent);
    if (teamPoints == null || opponentPoints == null) continue;
    const line = lineByEvent.get(String(event.id));
    const rawTeam = team.homeAway === "home" ? line?.home_team : line?.away_team;
    const spread = line && rawTeam ? normalizeSpreadForSelectedTeam(rawTeam, line.current_spread_team, line.current_spread) : null;
    const cover = spread == null ? null : Math.round((teamPoints - opponentPoints + spread) * 100) / 100;
    unique.set(String(event.id), {
      id: String(event.id), date, opponentId: String(opponent.team.id), opponent: opponent.team.displayName || "Unknown team",
      opponentLogo: opponent.team.logo || opponent.team.logos?.[0]?.href || null,
      home: team.homeAway === "home", neutralSite: Boolean(competition.neutralSite), teamPoints, opponentPoints,
      result: teamPoints > opponentPoints ? "W" : teamPoints < opponentPoints ? "L" : "P",
      spread, cover, ats: cover == null ? null : cover > 0 ? "W" : cover < 0 ? "L" : "P"
    });
  }
  return [...unique.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

export function basketballForm(id: string, name: string, logo: string | null, games: BasketballResult[]): BasketballForm {
  const average = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const covers = games.flatMap(game => game.cover == null ? [] : [game.cover]);
  return {
    id, name, logo, games, record: { wins: games.filter(game => game.result === "W").length, losses: games.filter(game => game.result === "L").length },
    points: average(games.map(game => game.teamPoints)), allowed: average(games.map(game => game.opponentPoints)),
    margin: average(games.map(game => game.teamPoints - game.opponentPoints)),
    ats: { wins: games.filter(game => game.ats === "W").length, losses: games.filter(game => game.ats === "L").length, pushes: games.filter(game => game.ats === "P").length, margin: average(covers) }
  };
}
