import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { requestedGroupFromRequest, resolveGroupContext, isGameAllowedForGroup } from "@/lib/groupContext";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { espnSportPath } from "@/lib/sportPaths";
import { isBasketballLeague } from "@/lib/basketballRules";
import { basketballShots } from "@/lib/basketballShots";
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
    const away = competitors.find((row: any) => row.homeAway === "away");
    const home = competitors.find((row: any) => row.homeAway === "home");
    const stats = data.boxscore?.teams || [];
    const teamStats = (side: any) => stats.find((row: any) => row.team?.id === side?.team?.id)?.statistics || [];
    const awayStats = teamStats(away), homeStats = teamStats(home);
    const athletes = new Map<string, string>();
    for (const team of data.boxscore?.players || []) for (const group of team.statistics || []) for (const player of group.athletes || []) {
      if (player.athlete?.id && player.athlete?.displayName) athletes.set(String(player.athlete.id), player.athlete.displayName);
    }
    const rawPlays = data.plays || data.scoringPlays || [];
    const plays = (data.plays || data.scoringPlays || []).map((play: any, index: number) => ({
      id: String(play.id || index), text: String(play.text || ""), period: Number(play.period?.number || 1),
      clock: String(play.clock?.displayValue || ""), scoring: Boolean(play.scoringPlay),
      awayScore: play.awayScore ?? null, homeScore: play.homeScore ?? null
    }));
    return NextResponse.json({
      ok: true, status: { ...competition?.status?.type, period: competition?.status?.period || 1, clock: competition?.status?.displayClock || "" },
      teams: { away: away ? { ...away, records: away.records || away.record || [] } : null, home: home ? { ...home, records: home.records || home.record || [] } : null },
      shots: basketballShots(rawPlays, athletes),
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
