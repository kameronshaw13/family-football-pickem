import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { normalizeTeamNameKey, teamDisplayName } from "@/lib/teamNames";

const CFBD_BASE_URL = "https://api.collegefootballdata.com";
const ESPN_CORE_BASE = "https://sports.core.api.espn.com/v2/sports/football/leagues/college-football";
const ESPN_SITE_BASE = "https://site.api.espn.com/apis/site/v2/sports/football/college-football";

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

  const recent = games.slice(-5).reverse().map((game) => {
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

function recentFromEspnSchedule(schedule: Awaited<ReturnType<typeof fetchEspnSchedule>>, targetDate: number) {
  return schedule
    .filter((game) => game.completed && game.teamPoints != null && game.opponentPoints != null && new Date(game.date).getTime() < targetDate)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)
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
  const awaySummary = summarizeLocalGames(awayLocalGames, away);
  const homeSummary = summarizeLocalGames(homeLocalGames, home);

  const [
    awayEspnStats,
    homeEspnStats,
    awayEspnAts,
    homeEspnAts,
    awaySchedule,
    homeSchedule,
    espnHistory,
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
    cfbd<CfbdTeamStat[]>("/stats/season", { year: season, endWeek, classification: "fbs" }, 1800),
    cfbd<CfbdAdvanced[]>("/stats/season/advanced", { year: season, endWeek, classification: "fbs", excludeGarbageTime: true }, 1800),
    cfbd<CfbdSp[]>("/ratings/sp", { year: season }, 3600),
    cfbd<CfbdMatchup>("/teams/matchup", { team1: away, team2: home }, 86400)
  ]);

  const cfbdRegularAway = cfbdStats ? cfbdRegularStats(cfbdStats, away, awayLocalGames.length) : null;
  const cfbdRegularHome = cfbdStats ? cfbdRegularStats(cfbdStats, home, homeLocalGames.length) : null;
  const localAwayAts = summarizeLocalAts(localGames, away, targetDate, season);
  const localHomeAts = summarizeLocalAts(localGames, home, targetDate, season);

  const awayRecentEspn = recentFromEspnSchedule(awaySchedule, targetDate);
  const homeRecentEspn = recentFromEspnSchedule(homeSchedule, targetDate);

  const awayData = {
    name: away,
    record: awaySummary.record,
    scoring: awaySummary.scoring,
    recent: awaySummary.recent.length ? awaySummary.recent : awayRecentEspn,
    regular: mergeRegular(cfbdRegularAway, awayEspnStats),
    ats: {
      wins: localAwayAts.recent.length ? localAwayAts.wins : awayEspnAts?.wins ?? 0,
      losses: localAwayAts.recent.length ? localAwayAts.losses : awayEspnAts?.losses ?? 0,
      pushes: localAwayAts.recent.length ? localAwayAts.pushes : awayEspnAts?.pushes ?? 0,
      avgCoverMargin: localAwayAts.avgCoverMargin,
      recent: localAwayAts.recent
    },
    advanced: cfbdAdvanced?.find((row) => sameTeam(row.team, away)) || null,
    sp: cfbdSp?.find((row) => sameTeam(row.team, away)) || null
  };

  const homeData = {
    name: home,
    record: homeSummary.record,
    scoring: homeSummary.scoring,
    recent: homeSummary.recent.length ? homeSummary.recent : homeRecentEspn,
    regular: mergeRegular(cfbdRegularHome, homeEspnStats),
    ats: {
      wins: localHomeAts.recent.length ? localHomeAts.wins : homeEspnAts?.wins ?? 0,
      losses: localHomeAts.recent.length ? localHomeAts.losses : homeEspnAts?.losses ?? 0,
      pushes: localHomeAts.recent.length ? localHomeAts.pushes : homeEspnAts?.pushes ?? 0,
      avgCoverMargin: localHomeAts.avgCoverMargin,
      recent: localHomeAts.recent
    },
    advanced: cfbdAdvanced?.find((row) => sameTeam(row.team, home)) || null,
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
      advanced: Boolean(cfbdAdvanced),
      sp: Boolean(cfbdSp),
      history: Boolean(headToHead),
      baseSource: "espn+pickem",
      advancedSource: cfbdAdvanced ? "cfbd" : null
    }
  }, {
    headers: { "Cache-Control": "private, max-age=0, must-revalidate" }
  });
}
