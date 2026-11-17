import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { requestedGroupFromRequest, resolveGroupContext, isGameAllowedForGroup } from "@/lib/groupContext";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { espnSportPath } from "@/lib/sportPaths";
import { isBasketballLeague } from "@/lib/basketballRules";
import { basketballShots } from "@/lib/basketballShots";
import { basketballLiveState } from "@/lib/basketballLiveState";
import { basketballSummarySwapped, orientBasketballPlayScores } from "@/lib/basketballSummaryOrientation";
import { createAsyncCache } from "@/lib/asyncCache";

export const dynamic = "force-dynamic";
const cache = createAsyncCache<any>(4000, 64);
const headers = { "Cache-Control": "no-store, max-age=0" };
export async function GET(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile) return NextResponse.json({ error: auth.error }, { status: auth.status, headers });
  try {
    const supabase = getSupabaseAdmin();
    const context = await resolveGroupContext(supabase, auth.profile.id, requestedGroupFromRequest(req));
    const id = req.nextUrl.searchParams.get("gameId");
    if (!id || id.length > 120) return NextResponse.json({ error: "A game is required." }, { status: 400, headers });
    const { data: game, error } = await supabase.from("games").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!game || !isBasketballLeague(game.league) || !isGameAllowedForGroup(context, game)) return NextResponse.json({ error: "Game not found." }, { status: 404, headers });
    const data = await cache(`${game.league}:${game.espn_event_id}`, async () => {
      const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${espnSportPath(game.league)}/summary?event=${encodeURIComponent(game.espn_event_id)}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error("Game details are temporarily unavailable.");
      return response.json();
    });
    const competition = data.header?.competitions?.[0];
    const competitors = competition?.competitors || [];
    const providerAway = competitors.find((row: any) => row.homeAway === "away");
    const providerHome = competitors.find((row: any) => row.homeAway === "home");
    const swapped = basketballSummarySwapped(game, providerHome, providerAway);
    const away = swapped ? providerHome : providerAway;
    const home = swapped ? providerAway : providerHome;
    const stats = data.boxscore?.teams || [];
    const teamStats = (side: any) => stats.find((row: any) => row.team?.id === side?.team?.id)?.statistics || [];
    const awayStats = teamStats(away), homeStats = teamStats(home);
    const athletes = new Map<string, string>();
    for (const team of data.boxscore?.players || []) for (const group of team.statistics || []) for (const player of group.athletes || []) {
      if (player.athlete?.id && player.athlete?.displayName) athletes.set(String(player.athlete.id), player.athlete.displayName);
    }
    const rawPlays = Array.isArray(data.plays) && data.plays.length ? data.plays : data.scoringPlays || [];
    const totalPeriods = game.league === "NBA" ? 4 : 2;
    const clockToSeconds = (clock: string) => {
      const match = String(clock || "").match(/(\d+):(\d{2})/);
      return match ? Number(match[1]) * 60 + Number(match[2]) : null;
    };
    const periodLength = game.league === "NBA" ? 12 * 60 : 20 * 60;
    const timeProgress = (period: number, clock: string) => {
      const remaining = clockToSeconds(clock);
      return remaining == null ? null : (Math.max(0, period - 1) * periodLength + Math.max(0, periodLength - remaining)) / (totalPeriods * periodLength);
    };
    const playById = new Map(rawPlays.map((row: any) => [String(row.id), row]));
    const probabilities = (Array.isArray(data.winprobability) ? data.winprobability : [])
      .map((entry: any, index: number) => {
        const homeProbability = Number(entry.homeWinPercentage);
        const play = playById.get(String(entry.playId)) as any;
        const progress = play ? timeProgress(Number(play.period?.number || 1), String(play.clock?.displayValue || "")) : null;
        return Number.isFinite(homeProbability) && homeProbability >= 0 && homeProbability <= 1
          ? { id: String(entry.playId || index), home: swapped ? 1 - homeProbability : homeProbability, progress } : null;
      }).filter((point: any) => point && point.progress != null)
      .sort((a: any, b: any) => a.progress - b.progress);
    const numeric = (value: unknown) => {
      const number = Number(value);
      return value == null || value === "" || !Number.isFinite(number) ? null : Math.max(0, Math.trunc(number));
    };
    const teamFouls = (competitor: any, statsRows: any[]) => {
      const direct = numeric(competitor?.fouls ?? competitor?.teamFouls ?? competitor?.foulsCommitted);
      if (direct != null) return direct;
      const row = statsRows.find((item: any) => /^(?:totalFouls|teamFouls|fouls)$/i.test(String(item.name || "")));
      return numeric(row?.displayValue ?? row?.value);
    };
    const timeoutValue = (competitor: any, max: number) => {
      const remaining = numeric(competitor?.timeoutsRemaining ?? competitor?.timeouts);
      if (remaining != null) return remaining;
      const used = numeric(competitor?.timeoutsUsed);
      return used == null ? null : Math.max(0, max - used);
    };
    const plays = rawPlays.map((play: any, index: number) => orientBasketballPlayScores({
      id: String(play.id || index), text: String(play.text || ""), period: Number(play.period?.number || 1),
      clock: String(play.clock?.displayValue || ""), scoring: Boolean(play.scoringPlay),
      progress: timeProgress(Number(play.period?.number || 1), String(play.clock?.displayValue || "")),
      side: String(play.team?.id || "") === String(away?.team?.id || "") ? "away" : String(play.team?.id || "") === String(home?.team?.id || "") ? "home" : null,
      awayScore: play.awayScore ?? null, homeScore: play.homeScore ?? null
    }, swapped));
    return NextResponse.json({
      ok: true, status: { ...competition?.status?.type, period: competition?.status?.period || 1, clock: competition?.status?.displayClock || "" },
      teams: { away: away ? { ...away, records: away.records || away.record || [], timeoutsRemaining: timeoutValue(away, game.league === "NBA" ? 7 : 4), fouls: teamFouls(away, awayStats) } : null, home: home ? { ...home, records: home.records || home.record || [], timeoutsRemaining: timeoutValue(home, game.league === "NBA" ? 7 : 4), fouls: teamFouls(home, homeStats) } : null },
      shots: basketballShots(rawPlays, athletes).map(shot => orientBasketballPlayScores(shot, swapped)),
      liveState: basketballLiveState(rawPlays, String(away?.team?.id || ""), String(home?.team?.id || "")),
      winProbability: probabilities,
      shotAttempts: rawPlays.filter((play: any) => play.shootingPlay && [2, 3].includes(Number(play.pointsAttempted))).length,
      stats: awayStats.map((row: any) => ({ label: row.label || row.displayName || row.name, away: row.displayValue, home: homeStats.find((item: any) => item.name === row.name)?.displayValue || "—" })),
      players: (data.boxscore?.players || []).map((row: any) => ({
        id: row.team?.id, name: row.team?.displayName, side: String(row.team?.id) === String(away?.team?.id) ? "away" : "home",
        groups: (row.statistics || []).map((group: any) => ({ labels: group.labels || [], athletes: (group.athletes || []).map((player: any) => ({ id: player.athlete?.id, name: player.athlete?.displayName, stats: player.stats || [] })) }))
      })),
      leaders: (data.leaders || []).map((row: any) => ({ name: row.team?.displayName, categories: (row.leaders || []).map((category: any) => ({ label: category.displayName, athletes: (category.leaders || []).map((leader: any) => ({ name: leader.athlete?.displayName, value: leader.displayValue })) })) })),
      plays
    }, { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load game." }, { status: 500, headers });
  }
}
