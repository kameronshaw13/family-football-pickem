import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { normalizeTeamNameKey, teamDisplayName } from "@/lib/teamNames";

const CFBD_BASE_URL = "https://api.collegefootballdata.com";
const ESPN_CORE_BASE = "https://sports.core.api.espn.com/v2/sports/football/leagues/college-football";
const ESPN_SITE_BASE = "https://site.api.espn.com/apis/site/v2/sports/football/college-football";
const SPORTSDATAVERSE_RELEASE_BASE = "https://github.com/sportsdataverse/sportsdataverse-data/releases/download";

type LocalGame = {
  id: string;
  week: number;
  commence_time: string;
  home_team: string;
  away_team: string;
  home_logo_url?: string | null;
  away_logo_url?: string | null;
  current_spread_team: string | null;
  current_spread: number | null;
  final_home_score: number | null;
  final_away_score: number | null;
};

type CfbdTeamStat = {
  season: number;
  team: string;
  conference: string;
  statName: string;
  statValue: string | number | null;
};

type CfbdAdvanced = {
  season: number;
  team: string;
  conference: string;
  offense?: Record<string, any>;
  defense?: Record<string, any>;
};

type CfbdSp = {
  year: number;
  team: string;
  conference: string | null;
  rating: number | null;
  ranking: number | null;
  offense?: { rating?: number | null; ranking?: number | null };
  defense?: { rating?: number | null; ranking?: number | null };
  specialTeams?: { rating?: number | null };
};

type CfbdMatchup = {
  team1: string;
  team2: string;
  team1Wins: number;
  team2Wins: number;
  ties: number;
  games: Array<{
    season: number;
    week: number;
    date: string;
    neutralSite: boolean;
    venue: string | null;
    homeTeam: string;
    homeScore: number;
    awayTeam: string;
    awayScore: number;
    winner: string | null;
  }>;
};

function sameTeam(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  const aSchool = teamDisplayName("CFB", a);
  const bSchool = teamDisplayName("CFB", b);
  return normalizeTeamNameKey(aSchool) === normalizeTeamNameKey(bSchool);
}

function finiteNumber(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function logoTeamId(url: string | null | undefined) {
  if (!url) return null;
  return url.match(/\/(\d+)\.(?:png|svg|webp)(?:\?|$)/i)?.[1] || null;
}

async function jsonFetch<T>(url: string, revalidate = 1800): Promise<T | null> {
  try {
    const response = await fetch(url, { next: { revalidate } });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}


type SportsDataRow = Record<string, string>;

type NormalizedAdvanced = {
  source: "sportsdataverse" | "cfbd" | "sportsdataverse+cfbd";
  throughWeek: number | null;
  offense?: {
    epaPerPlay?: number | null;
    ppaPerPlay?: number | null;
    successRate?: number | null;
    passEpaPerPlay?: number | null;
    rushEpaPerPlay?: number | null;
    passSuccessRate?: number | null;
    rushSuccessRate?: number | null;
    explosiveRate?: number | null;
    yardsPerPlay?: number | null;
    lineYardsPerCarry?: number | null;
    powerSuccessRate?: number | null;
    stuffRate?: number | null;
    earlyDownEpaPerPlay?: number | null;
    lateDownEpaPerPlay?: number | null;
    thirdDownSuccessRate?: number | null;
    redZoneSuccessRate?: number | null;
    pointsPerOpportunity?: number | null;
  };
  defense?: {
    havocRate?: number | null;
    passHavocRate?: number | null;
    rushHavocRate?: number | null;
    frontSevenHavocRate?: number | null;
    dbHavocRate?: number | null;
    sackRate?: number | null;
    tflRate?: number | null;
    driveStoppedRate?: number | null;
    stuffRate?: number | null;
  };
  ranks?: {
    offense?: Record<string, number | null>;
    defense?: Record<string, number | null>;
  };
};

function parseCsv(text: string): SportsDataRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      cell = "";
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      continue;
    }
    cell += char;
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((value) => value.length > 0)) rows.push(row);
  }

  const headers = rows.shift()?.map((value) => value.trim()) || [];
  if (!headers.length) return [];
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

async function fetchSportsDataCsv(dataset: string, filePrefix: string, season: number) {
  const url = `${SPORTSDATAVERSE_RELEASE_BASE}/${dataset}/${filePrefix}_${season}.csv`;
  try {
    const response = await fetch(url, { next: { revalidate: 900 } });
    if (!response.ok) return [] as SportsDataRow[];
    return parseCsv(await response.text());
  } catch {
    return [] as SportsDataRow[];
  }
}

function sportsRow(
  rows: SportsDataRow[],
  teamId: string | null,
  team: string,
  idKey: string,
  nameKey: string,
  requestedWeek: number
) {
  const matches = rows.filter((row) => {
    if (teamId && String(row[idKey] || "").trim() === String(teamId)) return true;
    return sameTeam(row[nameKey], team);
  });
  if (!matches.length) return null;
  matches.sort((a, b) => Number(b.week || 0) - Number(a.week || 0));
  const row = matches[0];
  const throughWeek = finiteNumber(row.week);
  if (requestedWeek > 0 && throughWeek != null && throughWeek >= requestedWeek) return null;
  return row;
}

function rowNumber(row: SportsDataRow | null, key: string) {
  return row ? finiteNumber(row[key]) : null;
}

function rankFromValues(value: number | null, values: number[], higherBetter = true) {
  if (value == null || !Number.isFinite(value) || !values.length) return null;
  return 1 + values.filter((candidate) => higherBetter ? candidate > value : candidate < value).length;
}

function sameSnapshotRows(rows: SportsDataRow[], row: SportsDataRow | null) {
  if (!row) return [] as SportsDataRow[];
  const week = finiteNumber(row.week);
  if (week == null) return rows;
  return rows.filter((candidate) => finiteNumber(candidate.week) === week);
}

function metricRank(rows: SportsDataRow[], row: SportsDataRow | null, key: string, higherBetter = true) {
  const value = rowNumber(row, key);
  const values = sameSnapshotRows(rows, row)
    .map((candidate) => finiteNumber(candidate[key]))
    .filter((candidate): candidate is number => candidate != null);
  return rankFromValues(value, values, higherBetter);
}

function derivedRank(
  rows: SportsDataRow[],
  row: SportsDataRow | null,
  getter: (candidate: SportsDataRow) => number | null,
  higherBetter = true
) {
  if (!row) return null;
  const value = getter(row);
  const values = sameSnapshotRows(rows, row)
    .map(getter)
    .filter((candidate): candidate is number => candidate != null);
  return rankFromValues(value, values, higherBetter);
}

function sportsAdvancedRanks(
  teamRows: SportsDataRow[],
  situationalRows: SportsDataRow[],
  defensiveRows: SportsDataRow[],
  teamRow: SportsDataRow | null,
  situationalRow: SportsDataRow | null,
  defensiveRow: SportsDataRow | null
) {
  const tflRate = (row: SportsDataRow) => {
    const plays = finiteNumber(row.scrimmage_plays);
    const tfl = finiteNumber(row.TFL);
    return plays && tfl != null ? tfl / plays : null;
  };
  return {
    offense: {
      epaPerPlay: metricRank(teamRows, teamRow, "EPA_per_play"),
      successRate: metricRank(situationalRows, situationalRow, "EPA_success_rate"),
      passEpaPerPlay: metricRank(teamRows, teamRow, "EPA_passing_per_play"),
      rushEpaPerPlay: metricRank(teamRows, teamRow, "EPA_rushing_per_play"),
      passSuccessRate: metricRank(situationalRows, situationalRow, "EPA_success_pass_rate"),
      rushSuccessRate: metricRank(situationalRows, situationalRow, "EPA_success_rush_rate"),
      explosiveRate: metricRank(teamRows, teamRow, "EPA_explosive_rate"),
      yardsPerPlay: metricRank(teamRows, teamRow, "yards_per_play"),
      lineYardsPerCarry: metricRank(teamRows, teamRow, "line_yards_per_carry"),
      powerSuccessRate: metricRank(teamRows, teamRow, "rushing_power_success_rate"),
      stuffRate: metricRank(teamRows, teamRow, "rushing_stuff_rate", false),
      earlyDownEpaPerPlay: metricRank(situationalRows, situationalRow, "EPA_early_down_per_play"),
      lateDownEpaPerPlay: metricRank(situationalRows, situationalRow, "EPA_late_down_per_play"),
      thirdDownSuccessRate: metricRank(situationalRows, situationalRow, "EPA_success_rate_third"),
      redZoneSuccessRate: metricRank(situationalRows, situationalRow, "EPA_success_rate_rz")
    },
    defense: {
      havocRate: metricRank(defensiveRows, defensiveRow, "havoc_total_rate"),
      passHavocRate: metricRank(defensiveRows, defensiveRow, "havoc_total_pass_rate"),
      rushHavocRate: metricRank(defensiveRows, defensiveRow, "havoc_total_rush_rate"),
      sackRate: metricRank(defensiveRows, defensiveRow, "sacks_rate"),
      tflRate: derivedRank(defensiveRows, defensiveRow, tflRate),
      driveStoppedRate: metricRank(defensiveRows, defensiveRow, "drive_stopped_rate")
    }
  };
}

function asRate(value: number | null, percentScale = false) {
  if (value == null) return null;
  if (percentScale || value > 1) return value / 100;
  return value;
}

function hasAdvancedValues(value: Record<string, number | null | undefined> | undefined) {
  return Boolean(value && Object.values(value).some((entry) => entry != null && Number.isFinite(Number(entry))));
}

function normalizeSportsAdvanced(
  teamRow: SportsDataRow | null,
  situationalRow: SportsDataRow | null,
  defensiveRow: SportsDataRow | null
): NormalizedAdvanced | null {
  const offense = {
    epaPerPlay: rowNumber(teamRow, "EPA_per_play"),
    successRate: asRate(rowNumber(situationalRow, "EPA_success_rate")),
    passEpaPerPlay: rowNumber(teamRow, "EPA_passing_per_play"),
    rushEpaPerPlay: rowNumber(teamRow, "EPA_rushing_per_play"),
    passSuccessRate: asRate(rowNumber(situationalRow, "EPA_success_pass_rate")),
    rushSuccessRate: asRate(rowNumber(situationalRow, "EPA_success_rush_rate")),
    explosiveRate: asRate(rowNumber(teamRow, "EPA_explosive_rate")),
    yardsPerPlay: rowNumber(teamRow, "yards_per_play"),
    lineYardsPerCarry: rowNumber(teamRow, "line_yards_per_carry"),
    powerSuccessRate: asRate(rowNumber(teamRow, "rushing_power_success_rate")),
    stuffRate: asRate(rowNumber(teamRow, "rushing_stuff_rate")),
    earlyDownEpaPerPlay: rowNumber(situationalRow, "EPA_early_down_per_play"),
    lateDownEpaPerPlay: rowNumber(situationalRow, "EPA_late_down_per_play"),
    thirdDownSuccessRate: asRate(rowNumber(situationalRow, "EPA_success_rate_third")),
    redZoneSuccessRate: asRate(rowNumber(situationalRow, "EPA_success_rate_rz"))
  };
  const scrimmagePlays = rowNumber(defensiveRow, "scrimmage_plays");
  const tfl = rowNumber(defensiveRow, "TFL");
  const defense = {
    havocRate: asRate(rowNumber(defensiveRow, "havoc_total_rate")),
    passHavocRate: asRate(rowNumber(defensiveRow, "havoc_total_pass_rate")),
    rushHavocRate: asRate(rowNumber(defensiveRow, "havoc_total_rush_rate")),
    sackRate: asRate(rowNumber(defensiveRow, "sacks_rate")),
    tflRate: scrimmagePlays && tfl != null ? tfl / scrimmagePlays : null,
    driveStoppedRate: asRate(rowNumber(defensiveRow, "drive_stopped_rate"), true)
  };

  if (!hasAdvancedValues(offense) && !hasAdvancedValues(defense)) return null;
  const weeks = [teamRow, situationalRow, defensiveRow]
    .map((row) => row ? finiteNumber(row.week) : null)
    .filter((value): value is number => value != null);
  return {
    source: "sportsdataverse",
    throughWeek: weeks.length ? Math.max(...weeks) : null,
    offense: hasAdvancedValues(offense) ? offense : undefined,
    defense: hasAdvancedValues(defense) ? defense : undefined
  };
}

function advancedPath(block: Record<string, any> | undefined, path: string[]) {
  let current: any = block;
  for (const key of path) {
    if (current == null || typeof current !== "object") return null;
    current = current[key];
  }
  return finiteNumber(current);
}

function normalizeCfbdAdvanced(row: CfbdAdvanced | undefined): NormalizedAdvanced | null {
  if (!row) return null;
  const offense = {
    ppaPerPlay: advancedPath(row.offense, ["ppa"]),
    successRate: advancedPath(row.offense, ["successRate"]),
    passSuccessRate: advancedPath(row.offense, ["passingPlays", "successRate"]),
    rushSuccessRate: advancedPath(row.offense, ["rushingPlays", "successRate"]),
    lineYardsPerCarry: advancedPath(row.offense, ["lineYards"]),
    pointsPerOpportunity: advancedPath(row.offense, ["pointsPerOpportunity"])
  };
  const defense = {
    havocRate: advancedPath(row.defense, ["havoc", "total"]),
    frontSevenHavocRate: advancedPath(row.defense, ["havoc", "frontSeven"]),
    dbHavocRate: advancedPath(row.defense, ["havoc", "db"]),
    stuffRate: advancedPath(row.defense, ["stuffRate"])
  };
  if (!hasAdvancedValues(offense) && !hasAdvancedValues(defense)) return null;
  return {
    source: "cfbd",
    throughWeek: null,
    offense: hasAdvancedValues(offense) ? offense : undefined,
    defense: hasAdvancedValues(defense) ? defense : undefined
  };
}

function mergeAdvanced(primary: NormalizedAdvanced | null, fallback: NormalizedAdvanced | null): NormalizedAdvanced | null {
  if (!primary) return fallback;
  if (!fallback) return primary;
  return {
    source: "sportsdataverse+cfbd",
    throughWeek: primary.throughWeek ?? fallback.throughWeek,
    offense: { ...(fallback.offense || {}), ...(primary.offense || {}) },
    defense: { ...(fallback.defense || {}), ...(primary.defense || {}) },
    ranks: {
      offense: { ...(fallback.ranks?.offense || {}), ...(primary.ranks?.offense || {}) },
      defense: { ...(fallback.ranks?.defense || {}), ...(primary.ranks?.defense || {}) }
    }
  };
}

function latestWeeklyRow(
  rows: SportsDataRow[],
  teamId: string | null,
  weekKey: string,
  maxWeek: number,
  extraFilter?: (row: SportsDataRow) => boolean
) {
  if (!teamId) return null;
  return rows
    .filter((row) => String(row.team_id || "").replace(/\.0$/, "") === String(teamId) &&
      (finiteNumber(row[weekKey]) ?? -1) <= maxWeek &&
      (!extraFilter || extraFilter(row)))
    .sort((a, b) => (finiteNumber(b[weekKey]) ?? -1) - (finiteNumber(a[weekKey]) ?? -1))[0] || null;
}

function exactWeeklySummaryRow(rows: SportsDataRow[], teamId: string | null, team: string, throughWeek: number) {
  if (throughWeek < 0) return null;
  return rows.find((row) => {
    if (finiteNumber(row.through_week) !== throughWeek) return false;
    const rowId = String(row.team_id || "").replace(/\.0$/, "");
    if (teamId && rowId === String(teamId)) return true;
    return sameTeam(row.team, team);
  }) || null;
}

function normalizeRelative(summaryRow: SportsDataRow | null) {
  if (!summaryRow) return null;
  const validGames = rowNumber(summaryRow, "valid_games");
  const enoughSample = validGames != null && validGames >= 3;
  const value = (key: string) => enoughSample ? rowNumber(summaryRow, key) : null;
  const rank = (key: string) => enoughSample ? rowNumber(summaryRow, key) : null;
  return {
    source: "sportsdataverse-team-summaries-weekly",
    throughWeek: rowNumber(summaryRow, "through_week"),
    validGames,
    enoughSample,
    overallValue: value("net_adj_epa"),
    overallRank: rank("net_adj_epa_rank"),
    offense: {
      adjustedEpa: value("adj_off_epa"),
      adjustedEpaRank: rank("adj_off_epa_rank"),
      epaPerPlay: value("EPAplay_off"),
      epaPerPlayRank: rank("EPAplay_off_rank"),
      successRate: value("success_off"),
      successRateRank: rank("success_off_rank"),
      explosivePlayRate: value("explosive_off"),
      explosivePlayRank: rank("explosive_off_rank"),
      yardsPerPlay: value("yardsplay_off"),
      yardsPerPlayRank: rank("yardsplay_off_rank"),
      lineYards: value("line_yards_off"),
      lineYardsRank: rank("line_yards_off_rank"),
      thirdDownRate: value("third_down_success_off"),
      thirdDownRank: rank("third_down_success_off_rank"),
      redZoneRate: value("red_zone_success_off"),
      redZoneRank: rank("red_zone_success_off_rank")
    },
    defense: {
      adjustedEpa: value("adj_def_epa"),
      adjustedEpaRank: rank("adj_def_epa_rank"),
      epaPerPlay: value("EPAplay_def"),
      epaPerPlayRank: rank("EPAplay_def_rank"),
      successRate: value("success_def"),
      successRateRank: rank("success_def_rank"),
      explosivePlayRate: value("explosive_def"),
      explosivePlayRank: rank("explosive_def_rank"),
      yardsPerPlay: value("yardsplay_def"),
      yardsPerPlayRank: rank("yardsplay_def_rank"),
      lineYards: value("line_yards_def"),
      lineYardsRank: rank("line_yards_def_rank"),
      thirdDownRate: value("third_down_success_def"),
      thirdDownRank: rank("third_down_success_def_rank"),
      redZoneRate: value("red_zone_success_def"),
      redZoneRank: rank("red_zone_success_def_rank")
    }
  };
}

function falseyCsv(value: string | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "" || normalized === "false" || normalized === "0" || normalized === "no";
}

function normalizePower(summaryRow: SportsDataRow | null, fpiRow: SportsDataRow | null) {
  if (!summaryRow && !fpiRow) return null;
  return {
    source: "sportsdataverse-team-summaries",
    throughWeek: rowNumber(summaryRow, "through_week") ?? rowNumber(fpiRow, "week"),
    fpi: rowNumber(fpiRow, "fpi"),
    fpiRank: rowNumber(fpiRow, "rank"),
    offenseEfficiency: rowNumber(fpiRow, "offefficiency"),
    offenseEfficiencyRank: rowNumber(fpiRow, "offefficiencyrank"),
    defenseEfficiency: rowNumber(fpiRow, "defefficiency"),
    defenseEfficiencyRank: rowNumber(fpiRow, "defefficiencyrank"),
    specialTeamsEfficiency: rowNumber(fpiRow, "stefficiency"),
    specialTeamsEfficiencyRank: rowNumber(fpiRow, "stefficiencyrank"),
    adjustedOffEpa: rowNumber(summaryRow, "adj_off_epa"),
    adjustedDefEpa: rowNumber(summaryRow, "adj_def_epa"),
    adjustedNetEpa: rowNumber(summaryRow, "net_adj_epa"),
    adjustedOffRank: rowNumber(summaryRow, "adj_off_epa_rank"),
    adjustedDefRank: rowNumber(summaryRow, "adj_def_epa_rank"),
    adjustedNetRank: rowNumber(summaryRow, "net_adj_epa_rank")
  };
}

type PowerSnapshot = NonNullable<ReturnType<typeof normalizePower>>;

async function cfbd<T>(path: string, params: Record<string, string | number | boolean | null | undefined>, revalidate = 1800) {
  const key = process.env.CFBD_API_KEY;
  if (!key) return null as T | null;
  const url = new URL(path, CFBD_BASE_URL);
  for (const [name, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") url.searchParams.set(name, String(value));
  }
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
      next: { revalidate }
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

function localGamesForTeam(games: LocalGame[], team: string, targetDate: number, season: number) {
  return games
    .filter((game) => {
      const kickoff = new Date(game.commence_time);
      return kickoff.getUTCFullYear() === season &&
        kickoff.getTime() < targetDate &&
        game.final_home_score != null &&
        game.final_away_score != null &&
        (sameTeam(game.home_team, team) || sameTeam(game.away_team, team));
    })
    .sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime());
}

function summarizeLocalGames(games: LocalGame[], team: string) {
  let wins = 0;
  let losses = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;

  for (const game of games) {
    const home = sameTeam(game.home_team, team);
    const teamPoints = Number(home ? game.final_home_score : game.final_away_score);
    const opponentPoints = Number(home ? game.final_away_score : game.final_home_score);
    if (teamPoints > opponentPoints) wins += 1;
    else if (teamPoints < opponentPoints) losses += 1;
    pointsFor += teamPoints;
    pointsAgainst += opponentPoints;
  }

  const recent = [...games].reverse().map((game) => {
    const home = sameTeam(game.home_team, team);
    const teamPoints = Number(home ? game.final_home_score : game.final_away_score);
    const opponentPoints = Number(home ? game.final_away_score : game.final_home_score);
    const opponent = home ? game.away_team : game.home_team;
    const margin = teamPoints - opponentPoints;
    return {
      id: game.id,
      week: game.week,
      date: game.commence_time,
      opponent,
      home,
      teamPoints,
      opponentPoints,
      margin,
      result: margin > 0 ? "W" : margin < 0 ? "L" : "T"
    };
  });

  return {
    record: { wins, losses },
    scoring: {
      ppg: games.length ? pointsFor / games.length : null,
      allowedPpg: games.length ? pointsAgainst / games.length : null,
      margin: games.length ? (pointsFor - pointsAgainst) / games.length : null
    },
    recent
  };
}

function spreadForLocalTeam(game: LocalGame, team: string) {
  if (game.current_spread == null || !game.current_spread_team) return null;
  const spread = Number(game.current_spread);
  if (!Number.isFinite(spread)) return null;
  return sameTeam(game.current_spread_team, team) ? spread : -spread;
}

function summarizeLocalAts(games: LocalGame[], team: string, targetDate: number, season: number) {
  const graded = localGamesForTeam(games, team, targetDate, season)
    .map((game) => {
      const spread = spreadForLocalTeam(game, team);
      if (spread == null) return null;
      const home = sameTeam(game.home_team, team);
      const teamPoints = Number(home ? game.final_home_score : game.final_away_score);
      const opponentPoints = Number(home ? game.final_away_score : game.final_home_score);
      const opponent = home ? game.away_team : game.home_team;
      const coverMargin = teamPoints - opponentPoints + spread;
      return {
        id: game.id,
        week: game.week,
        date: game.commence_time,
        opponent,
        home,
        spread,
        teamPoints,
        opponentPoints,
        coverMargin,
        result: Math.abs(coverMargin) < 0.001 ? "P" : coverMargin > 0 ? "W" : "L"
      };
    })
    .filter(Boolean) as Array<{
      id: string;
      week: number;
      date: string;
      opponent: string;
      home: boolean;
      spread: number;
      teamPoints: number;
      opponentPoints: number;
      coverMargin: number;
      result: "W" | "L" | "P";
    }>;

  const wins = graded.filter((game) => game.result === "W").length;
  const losses = graded.filter((game) => game.result === "L").length;
  const pushes = graded.filter((game) => game.result === "P").length;

  return {
    wins,
    losses,
    pushes,
    avgCoverMargin: graded.length ? graded.reduce((sum, game) => sum + game.coverMargin, 0) / graded.length : null,
    recent: graded.slice(-5).reverse()
  };
}

function flattenEspnStats(payload: any) {
  const rows = new Map<string, number>();
  const categories = payload?.splits?.categories || payload?.categories || [];
  for (const category of categories) {
    for (const stat of category?.stats || []) {
      const value = finiteNumber(stat?.value ?? stat?.displayValue);
      if (value == null) continue;
      const keys = [stat?.name, stat?.abbreviation, stat?.displayName, stat?.shortDisplayName]
        .filter(Boolean)
        .map((key) => String(key).toLowerCase().replace(/[^a-z0-9]/g, ""));
      for (const key of keys) rows.set(key, value);
    }
  }
  return rows;
}

function espnStat(stats: Map<string, number>, names: string[]) {
  for (const name of names) {
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const direct = stats.get(key);
    if (direct != null) return direct;
  }
  for (const name of names) {
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const [candidate, value] of Array.from(stats.entries())) {
      if (candidate.includes(key) || key.includes(candidate)) return value;
    }
  }
  return null;
}

async function fetchEspnTeamStats(teamId: string | null, season: number) {
  if (!teamId) return null;
  const url = `${ESPN_CORE_BASE}/seasons/${season}/types/2/teams/${teamId}/statistics`;
  const payload = await jsonFetch<any>(url, 1800);
  if (!payload) return null;
  const stats = flattenEspnStats(payload);
  return {
    yardsPerGame: espnStat(stats, ["yardsPerGame", "totalOffenseYardsPerGame", "offensiveYardsPerGame"]),
    passYardsPerGame: espnStat(stats, ["passingYardsPerGame", "netPassingYardsPerGame", "passYardsPerGame"]),
    rushYardsPerGame: espnStat(stats, ["rushingYardsPerGame", "rushYardsPerGame"]),
    turnoversPerGame: espnStat(stats, ["turnoversPerGame", "totalTurnoversPerGame", "turnovers"]),
    thirdDownPct: (() => {
      const raw = espnStat(stats, ["thirdDownConvPct", "thirdDownConversionPct", "thirdDownPct"]);
      return raw == null ? null : raw > 1 ? raw / 100 : raw;
    })()
  };
}

async function fetchEspnAts(teamId: string | null, season: number) {
  if (!teamId) return null;
  const url = `${ESPN_CORE_BASE}/seasons/${season}/types/2/teams/${teamId}/ats`;
  const payload = await jsonFetch<any>(url, 1800);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const overall = items.find((item: any) => item?.type?.name === "atsOverall") || items[0];
  if (!overall) return null;
  return {
    wins: Number(overall.wins || 0),
    losses: Number(overall.losses || 0),
    pushes: Number(overall.pushes || 0)
  };
}

function scheduleEvent(event: any, teamId: string) {
  const competition = event?.competitions?.[0];
  const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];
  const own = competitors.find((row: any) => String(row?.team?.id) === String(teamId));
  const opponent = competitors.find((row: any) => String(row?.team?.id) !== String(teamId));
  if (!own || !opponent) return null;
  const teamPoints = finiteNumber(own?.score?.value ?? own?.score);
  const opponentPoints = finiteNumber(opponent?.score?.value ?? opponent?.score);
  const completed = Boolean(competition?.status?.type?.completed || event?.status?.type?.completed);
  const date = competition?.date || event?.date;
  if (!date) return null;
  return {
    id: String(event?.id || competition?.id || date),
    date,
    week: Number(event?.week?.number || competition?.week?.number || 0),
    home: own?.homeAway === "home",
    neutralSite: Boolean(competition?.neutralSite),
    venue: competition?.venue?.fullName || null,
    ownName: own?.team?.displayName || own?.team?.shortDisplayName || "",
    opponentName: opponent?.team?.displayName || opponent?.team?.shortDisplayName || "",
    opponentId: String(opponent?.team?.id || ""),
    teamPoints,
    opponentPoints,
    completed
  };
}

async function fetchEspnSchedule(teamId: string | null, season: number) {
  if (!teamId) return [];
  const url = new URL(`${ESPN_SITE_BASE}/teams/${teamId}/schedule`);
  url.searchParams.set("season", String(season));
  const payload = await jsonFetch<any>(url.toString(), 3600);
  const events = Array.isArray(payload?.events) ? payload.events : [];
  return events.map((event: any) => scheduleEvent(event, teamId)).filter(Boolean) as Array<NonNullable<ReturnType<typeof scheduleEvent>>>;
}

function summarizeEspnSchedule(schedule: Awaited<ReturnType<typeof fetchEspnSchedule>>, targetDate: number) {
  const completed = schedule
    .filter((game) => game.completed && game.teamPoints != null && game.opponentPoints != null && new Date(game.date).getTime() < targetDate)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let wins = 0;
  let losses = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;
  for (const game of completed) {
    const teamPoints = Number(game.teamPoints);
    const opponentPoints = Number(game.opponentPoints);
    if (teamPoints > opponentPoints) wins += 1;
    else if (teamPoints < opponentPoints) losses += 1;
    pointsFor += teamPoints;
    pointsAgainst += opponentPoints;
  }
  return {
    games: completed.length,
    record: { wins, losses },
    scoring: {
      ppg: completed.length ? pointsFor / completed.length : null,
      allowedPpg: completed.length ? pointsAgainst / completed.length : null,
      margin: completed.length ? (pointsFor - pointsAgainst) / completed.length : null
    },
    recent: recentFromEspnSchedule(completed, targetDate)
  };
}

function recentFromEspnSchedule(schedule: Awaited<ReturnType<typeof fetchEspnSchedule>>, targetDate: number) {
  return schedule
    .filter((game) => game.completed && game.teamPoints != null && game.opponentPoints != null && new Date(game.date).getTime() < targetDate)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((game) => {
      const margin = Number(game.teamPoints) - Number(game.opponentPoints);
      return {
        id: game.id,
        week: game.week,
        date: game.date,
        opponent: game.opponentName,
        home: game.home,
        teamPoints: Number(game.teamPoints),
        opponentPoints: Number(game.opponentPoints),
        margin,
        result: margin > 0 ? "W" : margin < 0 ? "L" : "T"
      };
    });
}

async function fetchEspnHeadToHead(args: {
  away: string;
  home: string;
  awayId: string | null;
  homeId: string | null;
  season: number;
  targetDate: number;
}) {
  if (!args.awayId || !args.homeId) return null;

  const seasons = Array.from({ length: 8 }, (_, index) => args.season - index);
  const schedules = await Promise.all(seasons.map((year) => fetchEspnSchedule(args.awayId, year)));
  const meetings = schedules
    .flat()
    .filter((game) => game.completed &&
      game.teamPoints != null &&
      game.opponentPoints != null &&
      game.opponentId === args.homeId &&
      new Date(game.date).getTime() < args.targetDate)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  let team1Wins = 0;
  let team2Wins = 0;
  let ties = 0;
  for (const game of meetings) {
    if (Number(game.teamPoints) > Number(game.opponentPoints)) team1Wins += 1;
    else if (Number(game.teamPoints) < Number(game.opponentPoints)) team2Wins += 1;
    else ties += 1;
  }

  return {
    team1: args.away,
    team2: args.home,
    team1Wins,
    team2Wins,
    ties,
    games: meetings.slice(0, 8).map((game) => ({
      season: new Date(game.date).getUTCFullYear(),
      week: game.week,
      date: game.date,
      neutralSite: game.neutralSite,
      venue: game.venue,
      homeTeam: game.home ? args.away : args.home,
      homeScore: Number(game.home ? game.teamPoints : game.opponentPoints),
      awayTeam: game.home ? args.home : args.away,
      awayScore: Number(game.home ? game.opponentPoints : game.teamPoints),
      winner: Number(game.teamPoints) === Number(game.opponentPoints)
        ? null
        : Number(game.teamPoints) > Number(game.opponentPoints) ? args.away : args.home
    }))
  };
}

function statMap(rows: CfbdTeamStat[], team: string) {
  const map = new Map<string, string | number | null>();
  rows.filter((row) => sameTeam(row.team, team)).forEach((row) => {
    map.set(row.statName.replace(/[^a-z0-9]/gi, "").toLowerCase(), row.statValue);
  });
  return map;
}

function numericStat(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/,/g, "").trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function statRatio(value: string | number | null | undefined) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*[-/]\s*(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const attempts = Number(match[2]);
  return attempts ? Number(match[1]) / attempts : null;
}

function firstStat(map: Map<string, string | number | null>, names: string[]) {
  for (const name of names) {
    const value = map.get(name.replace(/[^a-z0-9]/gi, "").toLowerCase());
    const parsed = numericStat(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function firstRatio(map: Map<string, string | number | null>, names: string[]) {
  for (const name of names) {
    const value = map.get(name.replace(/[^a-z0-9]/gi, "").toLowerCase());
    const ratio = statRatio(value);
    if (ratio !== null) return ratio;
  }
  return null;
}

function cfbdRegularStats(rows: CfbdTeamStat[], team: string, gamesPlayed: number) {
  const stats = statMap(rows, team);
  const divisor = Math.max(gamesPlayed, 1);
  const totalYards = firstStat(stats, ["totalYards", "totalOffense", "yards"]);
  const passYards = firstStat(stats, ["netPassingYards", "passingYards"]);
  const rushYards = firstStat(stats, ["rushingYards"]);
  const turnovers = firstStat(stats, ["turnovers", "turnoversLost"]);
  return {
    yardsPerGame: totalYards == null ? null : totalYards / divisor,
    passYardsPerGame: passYards == null ? null : passYards / divisor,
    rushYardsPerGame: rushYards == null ? null : rushYards / divisor,
    turnoversPerGame: turnovers == null ? null : turnovers / divisor,
    thirdDownPct: firstRatio(stats, ["thirdDownConversions", "thirdDowns"])
  };
}

function mergeRegular(primary: Record<string, number | null> | null, fallback: Record<string, number | null> | null) {
  return {
    yardsPerGame: primary?.yardsPerGame ?? fallback?.yardsPerGame ?? null,
    passYardsPerGame: primary?.passYardsPerGame ?? fallback?.passYardsPerGame ?? null,
    rushYardsPerGame: primary?.rushYardsPerGame ?? fallback?.rushYardsPerGame ?? null,
    turnoversPerGame: primary?.turnoversPerGame ?? fallback?.turnoversPerGame ?? null,
    thirdDownPct: primary?.thirdDownPct ?? fallback?.thirdDownPct ?? null
  };
}

export async function GET(request: NextRequest) {
  const auth = await getProfileFromRequest(request);
  if (!auth.profile) return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: auth.status });

  const url = new URL(request.url);
  const rawAway = url.searchParams.get("away") || "";
  const rawHome = url.searchParams.get("home") || "";
  const requestedAwayId = url.searchParams.get("awayId");
  const requestedHomeId = url.searchParams.get("homeId");
  const date = url.searchParams.get("date") || "";
  const requestedWeek = Number(url.searchParams.get("week") || 0);
  const targetDate = new Date(date).getTime();
  const season = Number(url.searchParams.get("year")) || (Number.isFinite(targetDate) ? new Date(targetDate).getUTCFullYear() : new Date().getUTCFullYear());

  if (!rawAway || !rawHome || !Number.isFinite(targetDate)) {
    return NextResponse.json({ error: "Matchup teams and date are required." }, { status: 400 });
  }

  const away = teamDisplayName("CFB", rawAway);
  const home = teamDisplayName("CFB", rawHome);
  const endWeek = requestedWeek > 1 ? requestedWeek - 1 : undefined;

  const supabase = getSupabaseAdmin();
  const { data: gameRows, error: gameError } = await supabase
    .from("games")
    .select("id,week,league,commence_time,home_team,away_team,home_logo_url,away_logo_url,current_spread_team,current_spread,final_home_score,final_away_score")
    .eq("league", "CFB")
    .lt("commence_time", date)
    .order("commence_time", { ascending: true });
  if (gameError) throw new Error(gameError.message);

  const localGames = (gameRows || []) as LocalGame[];
  const awayId = requestedAwayId || localGames.map((game) => sameTeam(game.away_team, away) ? logoTeamId(game.away_logo_url) : sameTeam(game.home_team, away) ? logoTeamId(game.home_logo_url) : null).find(Boolean) || null;
  const homeId = requestedHomeId || localGames.map((game) => sameTeam(game.away_team, home) ? logoTeamId(game.away_logo_url) : sameTeam(game.home_team, home) ? logoTeamId(game.home_logo_url) : null).find(Boolean) || null;

  const awayLocalGames = localGamesForTeam(localGames, away, targetDate, season);
  const homeLocalGames = localGamesForTeam(localGames, home, targetDate, season);
  const awayLocalSummary = summarizeLocalGames(awayLocalGames, away);
  const homeLocalSummary = summarizeLocalGames(homeLocalGames, home);

  const [
    awayEspnStats,
    homeEspnStats,
    awayEspnAts,
    homeEspnAts,
    awaySchedule,
    homeSchedule,
    espnHistory,
    sportsTeamRows,
    sportsSituationalRows,
    sportsDefensiveRows,
    sportsSummaryRows,
    sportsFpiRows,
    cfbdStats,
    cfbdAdvanced,
    cfbdSp,
    cfbdHistory
  ] = await Promise.all([
    fetchEspnTeamStats(awayId, season),
    fetchEspnTeamStats(homeId, season),
    fetchEspnAts(awayId, season),
    fetchEspnAts(homeId, season),
    fetchEspnSchedule(awayId, season),
    fetchEspnSchedule(homeId, season),
    fetchEspnHeadToHead({ away, home, awayId, homeId, season, targetDate }),
    fetchSportsDataCsv("espn_cfb_adv_team", "adv_team", season),
    fetchSportsDataCsv("espn_cfb_adv_situational", "adv_situational", season),
    fetchSportsDataCsv("espn_cfb_adv_defensive", "adv_defensive", season),
    fetchSportsDataCsv("cfb_team_summaries_weekly", "cfb_team_summaries_weekly", season),
    fetchSportsDataCsv("cfb_fpi_weekly", "cfb_fpi_weekly", season),
    cfbd<CfbdTeamStat[]>("/stats/season", { year: season, endWeek, classification: "fbs" }, 1800),
    cfbd<CfbdAdvanced[]>("/stats/season/advanced", { year: season, endWeek, classification: "fbs", excludeGarbageTime: true }, 1800),
    cfbd<CfbdSp[]>("/ratings/sp", { year: season }, 3600),
    cfbd<CfbdMatchup>("/teams/matchup", { team1: away, team2: home }, 86400)
  ]);

  const cfbdRegularAway = cfbdStats ? cfbdRegularStats(cfbdStats, away, awayLocalGames.length) : null;
  const cfbdRegularHome = cfbdStats ? cfbdRegularStats(cfbdStats, home, homeLocalGames.length) : null;
  const localAwayAts = summarizeLocalAts(localGames, away, targetDate, season);
  const localHomeAts = summarizeLocalAts(localGames, home, targetDate, season);

  const awayEspnSummary = summarizeEspnSchedule(awaySchedule, targetDate);
  const homeEspnSummary = summarizeEspnSchedule(homeSchedule, targetDate);
  const awaySummary = awayEspnSummary.games ? awayEspnSummary : { ...awayLocalSummary, games: awayLocalGames.length };
  const homeSummary = homeEspnSummary.games ? homeEspnSummary : { ...homeLocalSummary, games: homeLocalGames.length };

  const ratingsThroughWeek = Math.max(0, requestedWeek - 1);
  const awaySummaryRow = exactWeeklySummaryRow(sportsSummaryRows, awayId, away, ratingsThroughWeek);
  const homeSummaryRow = exactWeeklySummaryRow(sportsSummaryRows, homeId, home, ratingsThroughWeek);
  const awayFpiRow = latestWeeklyRow(sportsFpiRows, awayId, "week", ratingsThroughWeek, (row) => falseyCsv(row.snapshot_out_of_sequence));
  const homeFpiRow = latestWeeklyRow(sportsFpiRows, homeId, "week", ratingsThroughWeek, (row) => falseyCsv(row.snapshot_out_of_sequence));
  const awayPower = normalizePower(awaySummaryRow, awayFpiRow);
  const homePower = normalizePower(homeSummaryRow, homeFpiRow);
  const awayRelative = normalizeRelative(awaySummaryRow);
  const homeRelative = normalizeRelative(homeSummaryRow);

  const awaySportsTeamRow = sportsRow(sportsTeamRows, awayId, away, "pos_team_id", "pos_team", requestedWeek);
  const awaySportsSituationalRow = sportsRow(sportsSituationalRows, awayId, away, "pos_team_id", "pos_team", requestedWeek);
  const awaySportsDefensiveRow = sportsRow(sportsDefensiveRows, awayId, away, "def_pos_team_id", "def_pos_team", requestedWeek);
  const homeSportsTeamRow = sportsRow(sportsTeamRows, homeId, home, "pos_team_id", "pos_team", requestedWeek);
  const homeSportsSituationalRow = sportsRow(sportsSituationalRows, homeId, home, "pos_team_id", "pos_team", requestedWeek);
  const homeSportsDefensiveRow = sportsRow(sportsDefensiveRows, homeId, home, "def_pos_team_id", "def_pos_team", requestedWeek);

  const awaySportsAdvanced = normalizeSportsAdvanced(awaySportsTeamRow, awaySportsSituationalRow, awaySportsDefensiveRow);
  const homeSportsAdvanced = normalizeSportsAdvanced(homeSportsTeamRow, homeSportsSituationalRow, homeSportsDefensiveRow);
  if (awaySportsAdvanced) awaySportsAdvanced.ranks = sportsAdvancedRanks(
    sportsTeamRows, sportsSituationalRows, sportsDefensiveRows,
    awaySportsTeamRow, awaySportsSituationalRow, awaySportsDefensiveRow
  );
  if (homeSportsAdvanced) homeSportsAdvanced.ranks = sportsAdvancedRanks(
    sportsTeamRows, sportsSituationalRows, sportsDefensiveRows,
    homeSportsTeamRow, homeSportsSituationalRow, homeSportsDefensiveRow
  );
  const awayCfbdAdvanced = normalizeCfbdAdvanced(cfbdAdvanced?.find((row) => sameTeam(row.team, away)));
  const homeCfbdAdvanced = normalizeCfbdAdvanced(cfbdAdvanced?.find((row) => sameTeam(row.team, home)));
  const awayAdvanced = mergeAdvanced(awaySportsAdvanced, awayCfbdAdvanced);
  const homeAdvanced = mergeAdvanced(homeSportsAdvanced, homeCfbdAdvanced);

  const awayData = {
    name: away,
    record: awaySummary.record,
    scoring: awaySummary.scoring,
    recent: awaySummary.recent,
    regular: mergeRegular(cfbdRegularAway, awayEspnStats),
    ats: {
      wins: awayEspnAts?.wins ?? localAwayAts.wins,
      losses: awayEspnAts?.losses ?? localAwayAts.losses,
      pushes: awayEspnAts?.pushes ?? localAwayAts.pushes,
      avgCoverMargin: localAwayAts.avgCoverMargin,
      recent: localAwayAts.recent
    },
    advanced: awayAdvanced,
    relative: awayRelative,
    power: awayPower,
    sp: cfbdSp?.find((row) => sameTeam(row.team, away)) || null
  };

  const homeData = {
    name: home,
    record: homeSummary.record,
    scoring: homeSummary.scoring,
    recent: homeSummary.recent,
    regular: mergeRegular(cfbdRegularHome, homeEspnStats),
    ats: {
      wins: homeEspnAts?.wins ?? localHomeAts.wins,
      losses: homeEspnAts?.losses ?? localHomeAts.losses,
      pushes: homeEspnAts?.pushes ?? localHomeAts.pushes,
      avgCoverMargin: localHomeAts.avgCoverMargin,
      recent: localHomeAts.recent
    },
    advanced: homeAdvanced,
    relative: homeRelative,
    power: homePower,
    sp: cfbdSp?.find((row) => sameTeam(row.team, home)) || null
  };

  const headToHead = cfbdHistory ? {
    team1: cfbdHistory.team1,
    team2: cfbdHistory.team2,
    team1Wins: cfbdHistory.team1Wins,
    team2Wins: cfbdHistory.team2Wins,
    ties: cfbdHistory.ties,
    games: [...(cfbdHistory.games || [])]
      .filter((game) => new Date(game.date).getTime() < targetDate)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8)
  } : espnHistory;

  return NextResponse.json({
    season,
    throughWeek: requestedWeek > 1 ? requestedWeek - 1 : 0,
    teams: { away: awayData, home: homeData },
    headToHead,
    availability: {
      games: awayLocalGames.length > 0 || homeLocalGames.length > 0 || awaySchedule.length > 0 || homeSchedule.length > 0,
      lines: localAwayAts.recent.length > 0 || localHomeAts.recent.length > 0 || Boolean(awayEspnAts || homeEspnAts),
      regularStats: Boolean(cfbdStats || awayEspnStats || homeEspnStats),
      advanced: Boolean(awayRelative?.enoughSample || homeRelative?.enoughSample),
      sp: Boolean(cfbdSp || awayPower || homePower),
      history: Boolean(headToHead),
      baseSource: "espn+pickem",
      advancedSource: awayRelative || homeRelative ? "sportsdataverse-team-summaries-weekly" : null
    }
  }, {
    headers: { "Cache-Control": "private, max-age=0, must-revalidate" }
  });
}
