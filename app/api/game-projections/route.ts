import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";

type ProjectionGame = {
  id: string;
  league: "CFB" | "NFL";
  commence_time: string;
  home_team: string;
  away_team: string;
  home_logo_url?: string | null;
  away_logo_url?: string | null;
};

type ScheduleGame = {
  date: string;
  completed: boolean;
  teamPoints: number | null;
  opponentPoints: number | null;
};

const ESPN_SITE = "https://site.api.espn.com/apis/site/v2/sports/football";

function isKameronProfile(profile: { username?: string | null; display_name?: string | null }) {
  const identity = `${profile.username || ""} ${profile.display_name || ""}`.toLowerCase();
  return /\bkameron\b/.test(identity);
}

function espnTeamId(url: string | null | undefined) {
  if (!url) return null;
  return url.match(/\/(\d+)\.(?:png|svg|webp)(?:\?|$)/i)?.[1] || null;
}

function leaguePath(league: "CFB" | "NFL") {
  return league === "CFB" ? "college-football" : "nfl";
}

function footballSeason(dateText: string) {
  const date = new Date(dateText);
  const year = date.getUTCFullYear();
  return date.getUTCMonth() <= 1 ? year - 1 : year;
}

async function fetchSchedule(league: "CFB" | "NFL", teamId: string, season: number) {
  const url = new URL(`${ESPN_SITE}/${leaguePath(league)}/teams/${teamId}/schedule`);
  url.searchParams.set("season", String(season));
  try {
    const response = await fetch(url.toString(), { next: { revalidate: 1800 } });
    if (!response.ok) return [] as ScheduleGame[];
    const payload = await response.json();
    const events = Array.isArray(payload?.events) ? payload.events : [];
    return events.map((event: any) => {
      const competition = event?.competitions?.[0];
      const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];
      const own = competitors.find((row: any) => String(row?.team?.id) === String(teamId));
      const opponent = competitors.find((row: any) => String(row?.team?.id) !== String(teamId));
      const teamRaw = own?.score?.value ?? own?.score;
      const oppRaw = opponent?.score?.value ?? opponent?.score;
      const teamPoints = teamRaw == null || teamRaw === "" ? null : Number(teamRaw);
      const opponentPoints = oppRaw == null || oppRaw === "" ? null : Number(oppRaw);
      return {
        date: competition?.date || event?.date || "",
        completed: Boolean(competition?.status?.type?.completed || event?.status?.type?.completed),
        teamPoints: Number.isFinite(teamPoints) ? teamPoints : null,
        opponentPoints: Number.isFinite(opponentPoints) ? opponentPoints : null
      };
    }).filter((game: ScheduleGame) => Boolean(game.date));
  } catch {
    return [] as ScheduleGame[];
  }
}

function summarize(schedule: ScheduleGame[], before: number) {
  const games = schedule.filter((game) =>
    game.completed &&
    game.teamPoints != null &&
    game.opponentPoints != null &&
    new Date(game.date).getTime() < before
  );
  if (!games.length) return null;
  const pointsFor = games.reduce((sum, game) => sum + Number(game.teamPoints), 0);
  const pointsAgainst = games.reduce((sum, game) => sum + Number(game.opponentPoints), 0);
  return {
    games: games.length,
    ppg: pointsFor / games.length,
    allowed: pointsAgainst / games.length,
    margin: (pointsFor - pointsAgainst) / games.length
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function shrink(value: number, games: number, mean: number) {
  const priorGames = 3;
  return (value * games + mean * priorGames) / (games + priorGames);
}

export async function POST(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!isKameronProfile(auth.profile)) return NextResponse.json({ error: "Private model." }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const games = (Array.isArray(body?.games) ? body.games : []).slice(0, 80) as ProjectionGame[];
  if (!games.length) return NextResponse.json({ projections: {} });

  const scheduleCache = new Map<string, Promise<ScheduleGame[]>>();
  const getSchedule = (game: ProjectionGame, side: "away" | "home") => {
    const logo = side === "away" ? game.away_logo_url : game.home_logo_url;
    const id = espnTeamId(logo);
    if (!id) return Promise.resolve([] as ScheduleGame[]);
    const season = footballSeason(game.commence_time);
    const key = `${game.league}:${id}:${season}`;
    if (!scheduleCache.has(key)) scheduleCache.set(key, fetchSchedule(game.league, id, season));
    return scheduleCache.get(key)!;
  };

  await Promise.all(games.flatMap((game) => [getSchedule(game, "away"), getSchedule(game, "home")]));

  const pairs = await Promise.all(games.map(async (game) => {
    const kickoff = new Date(game.commence_time).getTime();
    const [awaySchedule, homeSchedule] = await Promise.all([getSchedule(game, "away"), getSchedule(game, "home")]);
    const away = summarize(awaySchedule, kickoff);
    const home = summarize(homeSchedule, kickoff);
    if (!away || !home) return [game.id, null] as const;

    const leagueMean = game.league === "CFB" ? 28 : 22.5;
    const homeField = game.league === "CFB" ? 2.5 : 1.7;
    const awayOff = shrink(away.ppg, away.games, leagueMean);
    const awayDef = shrink(away.allowed, away.games, leagueMean);
    const homeOff = shrink(home.ppg, home.games, leagueMean);
    const homeDef = shrink(home.allowed, home.games, leagueMean);

    const awayBase = (awayOff + homeDef) / 2;
    const homeBase = (homeOff + awayDef) / 2;
    const matchupMargin = (homeBase - awayBase) + homeField;
    const seasonMargin = (home.margin - away.margin) / 2 + homeField;
    const modelMargin = 0.68 * matchupMargin + 0.32 * seasonMargin;
    const total = clamp(awayBase + homeBase + homeField * 0.2, 30, game.league === "CFB" ? 95 : 70);

    const homeScore = Math.round(clamp((total + modelMargin) / 2, 3, game.league === "CFB" ? 70 : 50));
    const awayScore = Math.round(clamp((total - modelMargin) / 2, 3, game.league === "CFB" ? 70 : 50));
    const roundedMargin = Math.round(Math.abs(modelMargin) * 2) / 2;
    const favoriteTeam = modelMargin > 0.25 ? game.home_team : modelMargin < -0.25 ? game.away_team : null;

    return [game.id, {
      gameId: game.id,
      awayScore,
      homeScore,
      favoriteTeam,
      spread: favoriteTeam ? -roundedMargin : 0,
      sampleGames: Math.min(away.games, home.games),
      version: "K Model v1"
    }] as const;
  }));

  return NextResponse.json({
    projections: Object.fromEntries(pairs.filter(([, value]) => value != null))
  });
}
