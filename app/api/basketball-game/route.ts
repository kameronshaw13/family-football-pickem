import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { requestedGroupFromRequest, resolveGroupContext, isGameAllowedForGroup } from "@/lib/groupContext";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { espnSportPath } from "@/lib/sportPaths";
import { isBasketballLeague, isInactiveBasketballEvent } from "@/lib/basketballRules";
import { basketballShots } from "@/lib/basketballShots";
import { basketballSituation } from "@/lib/basketballSituation";
import { basketballLiveState } from "@/lib/basketballLiveState";
import { basketballClosingHomeSpread, basketballSummarySwapped, orientBasketballPlayScores } from "@/lib/basketballSummaryOrientation";
import { createAsyncCache } from "@/lib/asyncCache";
import { hasValidGameLine } from "@/lib/gameDataIntegrity";
import { normalizeSpreadForSelectedTeam } from "@/lib/spreads";

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
    const homeSpread = isInactiveBasketballEvent(game.event_status) ? null : hasValidGameLine(game)
      ? normalizeSpreadForSelectedTeam(game.home_team, game.current_spread_team, game.current_spread)
      : basketballClosingHomeSpread(game, data);
    const stats = data.boxscore?.teams || [];
    const teamStats = (side: any) => stats.find((row: any) => row.team?.id === side?.team?.id)?.statistics || [];
    const awayStats = teamStats(away), homeStats = teamStats(home);
    const athletes = new Map<string, string>();
    for (const team of data.boxscore?.players || []) for (const group of team.statistics || []) for (const player of group.athletes || []) {
      if (player.athlete?.id && player.athlete?.displayName) athletes.set(String(player.athlete.id), player.athlete.displayName);
    }
    const rawPlays = Array.isArray(data.plays) && data.plays.length ? data.plays : data.scoringPlays || [];
    // Unlike the box score's accumulated fouls, ESPN core Situation carries
    // current-period team fouls and remaining timeouts.
    const coreSituation = await (async () => {
      if (competition?.status?.type?.completed || competition?.status?.type?.state !== "in") return null;
      try {
        const eventId = encodeURIComponent(String(game.espn_event_id));
        const league = game.league === "NBA" ? "nba" : "mens-college-basketball";
        const competitionId = encodeURIComponent(String(competition?.id || game.espn_event_id));
        const url = `https://sports.core.api.espn.com/v2/sports/basketball/leagues/${league}/events/${eventId}/competitions/${competitionId}/situation`;
        const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(3500) });
        return response.ok ? await response.json() : null;
      } catch { return null; }
    })();
    const totalPeriods = game.league === "NBA" ? 4 : 2;
    const clockToSeconds = (clock: string) => {
      const match = String(clock || "").match(/(\d+):(\d{2})/);
      return match ? Number(match[1]) * 60 + Number(match[2]) : null;
    };
    const periodLength = game.league === "NBA" ? 12 * 60 : 20 * 60;
    const timeProgress = (period: number, clock: string) => {
      const remaining = clockToSeconds(clock);
      const elapsedBeforePeriod = Math.min(totalPeriods, Math.max(0, period - 1)) * periodLength + Math.max(0, period - totalPeriods - 1) * 300;
      const length = period > totalPeriods ? 300 : periodLength;
      return remaining == null ? null : (elapsedBeforePeriod + Math.max(0, length - remaining)) / (totalPeriods * periodLength);
    };
    const playById = new Map(rawPlays.map((row: any) => [String(row.id), row]));
    const probabilities = (Array.isArray(data.winprobability) ? data.winprobability : [])
      .map((entry: any, index: number) => {
        const homeProbability = Number(entry.homeWinPercentage);
        const play = playById.get(String(entry.playId)) as any;
        const progress = play ? timeProgress(Number(play.period?.number || 1), String(play.clock?.displayValue || "")) : null;
        return play && progress != null && Number.isFinite(homeProbability) && homeProbability >= 0 && homeProbability <= 1
          ? { id: String(entry.playId || index), home: swapped ? 1 - homeProbability : homeProbability, progress, period: Number(play.period?.number || 1), clock: String(play.clock?.displayValue || ""), awayScore: swapped ? play.homeScore ?? null : play.awayScore ?? null, homeScore: swapped ? play.awayScore ?? null : play.homeScore ?? null } : null;
      }).filter((point: any) => point && point.progress != null)
      .sort((a: any, b: any) => a.progress - b.progress);
    const latestPlay = rawPlays[rawPlays.length - 1];
    const currentPeriod = Number(competition?.status?.period || latestPlay?.period?.number || 1);
    const situationFor = (side: "away" | "home", competitor: any) => basketballSituation(
      coreSituation, side, swapped, competitor, rawPlays, currentPeriod, game.league === "CBB"
    );
    const plays = rawPlays.map((play: any, index: number) => orientBasketballPlayScores({
      id: String(play.id || index), text: String(play.text || ""), period: Number(play.period?.number || 1),
      clock: String(play.clock?.displayValue || ""), scoring: Boolean(play.scoringPlay),
      progress: timeProgress(Number(play.period?.number || 1), String(play.clock?.displayValue || "")),
      side: String(play.team?.id || "") === String(away?.team?.id || "") ? "away" : String(play.team?.id || "") === String(home?.team?.id || "") ? "home" : null,
      awayScore: play.awayScore ?? null, homeScore: play.homeScore ?? null
    }, swapped));
    return NextResponse.json({
      ok: true, status: { ...competition?.status?.type, period: currentPeriod, clock: competition?.status?.displayClock || latestPlay?.clock?.displayValue || "" },
      teams: { away: away ? { ...away, records: away.records || away.record || [], ...situationFor("away", away) } : null, home: home ? { ...home, records: home.records || home.record || [], ...situationFor("home", home) } : null },
      shots: basketballShots(rawPlays, athletes).map(shot => orientBasketballPlayScores(shot, swapped)),
      liveState: basketballLiveState(rawPlays, String(away?.team?.id || ""), String(home?.team?.id || "")),
      winProbability: probabilities,
      homeSpread,
      shotAttempts: rawPlays.filter((play: any) => play.shootingPlay && [2, 3].includes(Number(play.pointsAttempted))).length,
      stats: awayStats.map((row: any) => ({ label: row.label || row.displayName || row.name, away: row.displayValue, home: homeStats.find((item: any) => item.name === row.name)?.displayValue || "—" })),
      players: (data.boxscore?.players || []).map((row: any) => ({
        id: row.team?.id, name: row.team?.displayName, side: String(row.team?.id) === String(away?.team?.id) ? "away" : "home",
        groups: (row.statistics || []).map((group: any) => ({ labels: group.labels || [], athletes: (group.athletes || []).map((player: any) => ({ id: player.athlete?.id, name: player.athlete?.displayName, starter: typeof player.starter === "boolean" ? player.starter : null, stats: player.stats || [] })) }))
      })),
      leaders: (data.leaders || []).map((row: any) => ({ name: row.team?.displayName, categories: (row.leaders || []).map((category: any) => ({ label: category.displayName, athletes: (category.leaders || []).map((leader: any) => ({ name: leader.athlete?.displayName, value: leader.displayValue })) })) })),
      plays
    }, { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load game." }, { status: 500, headers });
  }
}
