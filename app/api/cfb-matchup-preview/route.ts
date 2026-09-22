import { NextResponse } from "next/server";
import { normalizeTeamNameKey, teamDisplayName } from "@/lib/teamNames";

const CFBD_BASE_URL = "https://api.collegefootballdata.com";

type CfbdGame = {
  id: number;
  season: number;
  week: number;
  startDate: string;
  completed: boolean;
  homeTeam: string;
  awayTeam: string;
  homePoints: number | null;
  awayPoints: number | null;
};

type CfbdLine = {
  provider?: string | null;
  spread?: number | null;
  formattedSpread?: string | null;
};

type CfbdBettingGame = {
  id: number;
  season: number;
  week: number;
  startDate: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  lines: CfbdLine[];
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
  return normalizeTeamNameKey(a) === normalizeTeamNameKey(b);
}

async function cfbd<T>(path: string, params: Record<string, string | number | boolean | null | undefined>, revalidate = 1800) {
  const key = process.env.CFBD_API_KEY;
  if (!key) return { ok: false as const, status: 503, data: null as T | null };

  const url = new URL(path, CFBD_BASE_URL);
  for (const [name, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") url.searchParams.set(name, String(value));
  }

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
      next: { revalidate }
    });
    if (!response.ok) return { ok: false as const, status: response.status, data: null as T | null };
    return { ok: true as const, status: 200, data: await response.json() as T };
  } catch {
    return { ok: false as const, status: 502, data: null as T | null };
  }
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

function statMap(rows: CfbdTeamStat[], team: string) {
  const map = new Map<string, string | number | null>();
  rows.filter((row) => sameTeam(row.team, team)).forEach((row) => {
    map.set(row.statName.replace(/[^a-z0-9]/gi, "").toLowerCase(), row.statValue);
  });
  return map;
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

function completedGamesForTeam(games: CfbdGame[], team: string, targetDate: number) {
  return games
    .filter((game) => game.completed && new Date(game.startDate).getTime() < targetDate && (sameTeam(game.homeTeam, team) || sameTeam(game.awayTeam, team)))
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
}

function summarizeGames(games: CfbdGame[], team: string) {
  let wins = 0;
  let losses = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;

  const recent = games.slice(-5).reverse().map((game) => {
    const home = sameTeam(game.homeTeam, team);
    const teamPoints = Number(home ? game.homePoints : game.awayPoints);
    const opponentPoints = Number(home ? game.awayPoints : game.homePoints);
    const opponent = home ? game.awayTeam : game.homeTeam;
    const margin = teamPoints - opponentPoints;
    if (margin > 0) wins += 1;
    else if (margin < 0) losses += 1;
    pointsFor += teamPoints;
    pointsAgainst += opponentPoints;
    return {
      id: game.id,
      week: game.week,
      date: game.startDate,
      opponent,
      home,
      teamPoints,
      opponentPoints,
      margin,
      result: margin > 0 ? "W" : margin < 0 ? "L" : "T"
    };
  });

  if (games.length > 5) {
    wins = 0;
    losses = 0;
    pointsFor = 0;
    pointsAgainst = 0;
    for (const game of games) {
      const home = sameTeam(game.homeTeam, team);
      const teamPoints = Number(home ? game.homePoints : game.awayPoints);
      const opponentPoints = Number(home ? game.awayPoints : game.homePoints);
      if (teamPoints > opponentPoints) wins += 1;
      else if (teamPoints < opponentPoints) losses += 1;
      pointsFor += teamPoints;
      pointsAgainst += opponentPoints;
    }
  }

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

function preferredLine(lines: CfbdLine[] | null | undefined) {
  if (!lines?.length) return null;
  return lines.find((line) => /consensus/i.test(line.provider || "")) ||
    lines.find((line) => /draftkings|fanduel|betmgm|caesars/i.test(line.provider || "")) ||
    lines[0];
}

function spreadForTeam(game: CfbdBettingGame, team: string) {
  const line = preferredLine(game.lines);
  if (!line) return null;
  const formatted = line.formattedSpread?.trim();
  if (formatted) {
    const match = formatted.match(/^(.*?)\s+([+-]?\d+(?:\.\d+)?)$/);
    if (match) {
      const listedTeam = match[1].trim();
      const listedSpread = Number(match[2]);
      if (Number.isFinite(listedSpread)) return sameTeam(team, listedTeam) ? listedSpread : -listedSpread;
    }
  }

  const spread = Number(line.spread);
  if (!Number.isFinite(spread)) return null;
  return sameTeam(team, game.homeTeam) ? spread : -spread;
}

function summarizeAts(lines: CfbdBettingGame[], team: string, targetDate: number) {
  const graded = lines
    .filter((game) => new Date(game.startDate).getTime() < targetDate && game.homeScore != null && game.awayScore != null && (sameTeam(game.homeTeam, team) || sameTeam(game.awayTeam, team)))
    .map((game) => {
      const spread = spreadForTeam(game, team);
      if (spread == null) return null;
      const home = sameTeam(game.homeTeam, team);
      const teamPoints = Number(home ? game.homeScore : game.awayScore);
      const opponentPoints = Number(home ? game.awayScore : game.homeScore);
      const opponent = home ? game.awayTeam : game.homeTeam;
      const coverMargin = teamPoints - opponentPoints + spread;
      return {
        id: game.id,
        week: game.week,
        date: game.startDate,
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
      id: number;
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

function advancedForTeam(rows: CfbdAdvanced[], team: string) {
  return rows.find((row) => sameTeam(row.team, team)) || null;
}

function spForTeam(rows: CfbdSp[], team: string) {
  return rows.find((row) => sameTeam(row.team, team)) || null;
}

function teamPayload(args: {
  team: string;
  games: CfbdGame[];
  lines: CfbdBettingGame[];
  stats: CfbdTeamStat[];
  advanced: CfbdAdvanced[];
  sp: CfbdSp[];
  targetDate: number;
}) {
  const teamGames = completedGamesForTeam(args.games, args.team, args.targetDate);
  const summary = summarizeGames(teamGames, args.team);
  const stats = statMap(args.stats, args.team);
  const gameCount = Math.max(teamGames.length, 1);
  const totalYards = firstStat(stats, ["totalYards", "totalOffense", "yards"]);
  const passYards = firstStat(stats, ["netPassingYards", "passingYards"]);
  const rushYards = firstStat(stats, ["rushingYards"]);
  const turnovers = firstStat(stats, ["turnovers", "turnoversLost"]);
  const thirdDownPct = firstRatio(stats, ["thirdDownConversions", "thirdDowns"]);

  return {
    name: args.team,
    ...summary,
    regular: {
      yardsPerGame: totalYards == null ? null : totalYards / gameCount,
      passYardsPerGame: passYards == null ? null : passYards / gameCount,
      rushYardsPerGame: rushYards == null ? null : rushYards / gameCount,
      turnoversPerGame: turnovers == null ? null : turnovers / gameCount,
      thirdDownPct
    },
    ats: summarizeAts(args.lines, args.team, args.targetDate),
    advanced: advancedForTeam(args.advanced, args.team),
    sp: spForTeam(args.sp, args.team)
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawAway = url.searchParams.get("away") || "";
  const rawHome = url.searchParams.get("home") || "";
  const date = url.searchParams.get("date") || "";
  const requestedWeek = Number(url.searchParams.get("week") || 0);
  const targetDate = new Date(date).getTime();
  const season = Number(url.searchParams.get("year")) || (Number.isFinite(targetDate) ? new Date(targetDate).getUTCFullYear() : new Date().getUTCFullYear());

  if (!rawAway || !rawHome || !Number.isFinite(targetDate)) {
    return NextResponse.json({ error: "Matchup teams and date are required." }, { status: 400 });
  }

  if (!process.env.CFBD_API_KEY) {
    return NextResponse.json({ error: "CFB analytics are not configured yet.", code: "CFBD_NOT_CONFIGURED" }, { status: 503 });
  }

  const away = teamDisplayName("CFB", rawAway);
  const home = teamDisplayName("CFB", rawHome);
  const endWeek = requestedWeek > 1 ? requestedWeek - 1 : undefined;

  const [gamesResult, linesResult, statsResult, advancedResult, spResult, matchupResult] = await Promise.all([
    cfbd<CfbdGame[]>("/games", { year: season, classification: "fbs" }, 1800),
    cfbd<CfbdBettingGame[]>("/lines", { year: season }, 1800),
    cfbd<CfbdTeamStat[]>("/stats/season", { year: season, endWeek, classification: "fbs" }, 1800),
    cfbd<CfbdAdvanced[]>("/stats/season/advanced", { year: season, endWeek, classification: "fbs", excludeGarbageTime: true }, 1800),
    cfbd<CfbdSp[]>("/ratings/sp", { year: season }, 3600),
    cfbd<CfbdMatchup>("/teams/matchup", { team1: away, team2: home }, 86400)
  ]);

  const coreResults = [gamesResult, linesResult, statsResult, advancedResult, spResult];
  if (coreResults.every((result) => !result.ok)) {
    const authFailure = coreResults.some((result) => result.status === 401 || result.status === 403);
    return NextResponse.json({
      error: authFailure ? "CFB analytics access needs attention." : "CFB analytics are temporarily unavailable.",
      code: authFailure ? "CFBD_AUTH" : "CFBD_UNAVAILABLE"
    }, { status: authFailure ? 503 : 502 });
  }

  const games = gamesResult.data || [];
  const lines = linesResult.data || [];
  const stats = statsResult.data || [];
  const advanced = advancedResult.data || [];
  const sp = spResult.data || [];
  const awayData = teamPayload({ team: away, games, lines, stats, advanced, sp, targetDate });
  const homeData = teamPayload({ team: home, games, lines, stats, advanced, sp, targetDate });
  const matchup = matchupResult.data;

  return NextResponse.json({
    season,
    throughWeek: requestedWeek > 1 ? requestedWeek - 1 : 0,
    teams: { away: awayData, home: homeData },
    headToHead: matchup ? {
      team1: matchup.team1,
      team2: matchup.team2,
      team1Wins: matchup.team1Wins,
      team2Wins: matchup.team2Wins,
      ties: matchup.ties,
      games: [...(matchup.games || [])]
        .filter((game) => new Date(game.date).getTime() < targetDate)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 8)
    } : null,
    availability: {
      games: gamesResult.ok,
      lines: linesResult.ok,
      regularStats: statsResult.ok,
      advanced: advancedResult.ok,
      sp: spResult.ok,
      history: matchupResult.ok
    }
  }, {
    headers: { "Cache-Control": "private, max-age=0, must-revalidate" }
  });
}
