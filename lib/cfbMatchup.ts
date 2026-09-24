import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { teamDisplayName } from "@/lib/teamNames";
import { createAsyncCache } from "./asyncCache";
import {
  parseCsv, logoTeamId, exactWeeklySummaryRow, latestWeeklyRow,
  normalizeRelative, normalizePower, falseyCsv, localGamesForTeam,
  summarizeLocalGames, summarizeLocalAts, scheduleEvent, summarizeEspnSchedule,
  type SportsDataRow, type LocalGame
} from "./cfbMatchupData";

const csvCache = createAsyncCache<SportsDataRow[]>(15 * 60_000, 4);
type Schedule = Array<NonNullable<ReturnType<typeof scheduleEvent>>>;
const scheduleCache = createAsyncCache<Schedule>(15 * 60_000, 64);
const previewCache = createAsyncCache<Awaited<ReturnType<typeof buildMatchup>>>(5 * 60_000, 64);
const historyCache = createAsyncCache<Awaited<ReturnType<typeof buildHistory>>>(60 * 60_000, 32);
export type MatchupGame = LocalGame & { league: string };
export type MatchupPayload = Awaited<ReturnType<typeof buildMatchup>>;
export type MatchupTeam = MatchupPayload["teams"]["away"];
export type MatchupHistory = Awaited<ReturnType<typeof buildHistory>>;

async function fetchCsv(dataset: string, season: number) {
  return csvCache(`${dataset}:${season}`, async () => {
    const response = await fetch(`https://github.com/sportsdataverse/sportsdataverse-data/releases/download/${dataset}/${dataset}_${season}.csv`, {
      cache: "no-store", signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw new Error("Weekly stats unavailable");
    // Discard unused columns before retaining season data in memory.
    return parseCsv(await response.text(), (key) =>
      ["team", "pos_team", "team_id", "through_week", "valid_games", "week", "snapshot_out_of_sequence", "fpi", "rank"].includes(key) ||
      /^(net_adj_epa|adj_off_epa|adj_def_epa|EPAplay_|success_|explosive_|yardsplay_|line_yards_|third_down_success_|red_zone_success_)/.test(key));
  });
}

async function schedule(teamId: string | null, season: number): Promise<Schedule> {
  if (!teamId) return [];
  return scheduleCache(`${teamId}:${season}`, async () => {
    const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/${teamId}/schedule?season=${season}`, {
      next: { revalidate: 900 }, signal: AbortSignal.timeout(8_000)
    });
    if (!response.ok) throw new Error("Schedule unavailable");
    const payload = await response.json();
    const events = Array.isArray(payload?.events) ? payload.events : [];
    return events.map((event: unknown) => scheduleEvent(event, teamId)).filter(Boolean) as Schedule;
  });
}

function seasonFor(game: MatchupGame) {
  const date = new Date(game.commence_time);
  return date.getUTCMonth() < 2 ? date.getUTCFullYear() - 1 : date.getUTCFullYear();
}

async function buildMatchup(game: MatchupGame) {
  const season = seasonFor(game);
  const throughWeek = Math.max(0, game.week - 1);
  const targetDate = new Date(game.commence_time).getTime();
  const away = teamDisplayName("CFB", game.away_team);
  const home = teamDisplayName("CFB", game.home_team);
  const awayId = logoTeamId(game.away_logo_url);
  const homeId = logoTeamId(game.home_logo_url);
  const supabase = getSupabaseAdmin();
  const localRequest = supabase.from("games")
    .select("id,week,commence_time,home_team,away_team,current_spread_team,current_spread,final_home_score,final_away_score")
    .eq("league", "CFB")
    .gte("commence_time", `${season}-08-01T00:00:00Z`)
    .lt("commence_time", game.commence_time)
    .or(`home_team.in.(${JSON.stringify(game.away_team)},${JSON.stringify(game.home_team)}),away_team.in.(${JSON.stringify(game.away_team)},${JSON.stringify(game.home_team)})`)
    .order("commence_time", { ascending: true })
    .limit(100)
    .abortSignal(AbortSignal.timeout(8_000));
  const [local, awaySchedule, homeSchedule, summaries, fpi] = await Promise.all([
    localRequest,
    schedule(awayId, season).catch(() => [] as Schedule),
    schedule(homeId, season).catch(() => [] as Schedule),
    fetchCsv("cfb_team_summaries_weekly", season).catch(() => [] as SportsDataRow[]),
    fetchCsv("cfb_fpi_weekly", season).catch(() => [] as SportsDataRow[])
  ]);
  const localGames = (local.data || []) as LocalGame[];
  const makeTeam = (name: string, id: string | null, games: Schedule) => {
    const espn = summarizeEspnSchedule(games, targetDate);
    const localTeamGames = localGamesForTeam(localGames, name, targetDate, season);
    const summary = espn.games ? espn : summarizeLocalGames(localTeamGames, name);
    const row = exactWeeklySummaryRow(summaries, id, name, throughWeek);
    const fpiRow = latestWeeklyRow(fpi, id, "week", throughWeek, (value) => falseyCsv(value.snapshot_out_of_sequence));
    return {
      name, record: summary.record, scoring: summary.scoring, recent: summary.recent,
      // One source and one cutoff for the record, margin, and game list.
      ats: { ...summarizeLocalAts(localGames, name, targetDate, season), available: !local.error },
      relative: normalizeRelative(row),
      power: normalizePower(row, fpiRow),
      resultsAvailable: games.length > 0 || localTeamGames.length > 0
    };
  };
  return {
    season, throughWeek, fetchedAt: new Date().toISOString(),
    teams: { away: makeTeam(away, awayId, awaySchedule), home: makeTeam(home, homeId, homeSchedule) }
  };
}

async function buildHistory(game: MatchupGame) {
  const season = seasonFor(game);
  const awayId = logoTeamId(game.away_logo_url);
  const homeId = logoTeamId(game.home_logo_url);
  if (!awayId || !homeId) return { games: [], seasons: 8, complete: false };
  const snapshots = await Promise.all(Array.from({ length: 8 }, (_, index) =>
    schedule(awayId, season - index).then(games => ({ games, ok: true })).catch(() => ({ games: [] as Schedule, ok: false }))));
  const games = snapshots.flatMap(row => row.games)
    .filter(row => row.completed && row.teamPoints != null && row.opponentPoints != null &&
      row.opponentId === homeId && new Date(row.date).getTime() < new Date(game.commence_time).getTime())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return { games, seasons: 8, complete: snapshots.every(row => row.ok) };
}

export function loadMatchup(game: MatchupGame) {
  return previewCache(`${game.id}:${game.week}:${game.commence_time}`, () => buildMatchup(game));
}
export function loadMatchupHistory(game: MatchupGame) {
  return historyCache(`${game.id}:${game.commence_time}`, () => buildHistory(game));
}
