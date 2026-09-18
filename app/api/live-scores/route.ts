import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { fetchEspnSchedule, findEspnScheduleMatch } from "@/lib/espnSchedule";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

export async function GET(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status, headers: NO_STORE_HEADERS }
    );
  }

  const week = Number(req.nextUrl.searchParams.get("week"));
  if (!Number.isInteger(week) || week < 0) {
    return NextResponse.json(
      { ok: false, error: "A valid week is required." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const lookbackIso = new Date(now - 18 * 60 * 60 * 1000).toISOString();

    // This endpoint is deliberately read-only. Score polling must never wait on
    // pick locking, grading, notifications, settlement, or unrelated database writes.
    const { data: candidates, error } = await supabase
      .from("games")
      .select("id,espn_event_id,week,league,commence_time,home_team,away_team,final_home_score,final_away_score")
      .eq("week", week)
      .is("final_home_score", null)
      .is("final_away_score", null)
      .lte("commence_time", nowIso)
      .gte("commence_time", lookbackIso)
      .in("league", ["CFB", "NFL"]);

    if (error) throw error;

    if (!(candidates || []).length) {
      return NextResponse.json(
        { ok: true, games: [], needsFinalization: false },
        { headers: NO_STORE_HEADERS }
      );
    }

    const schedules = new Map<string, Awaited<ReturnType<typeof fetchEspnSchedule>>>();
    await Promise.all((["CFB", "NFL"] as const).map(async (league) => {
      const leagueGames = (candidates || []).filter((game) => game.league === league);
      if (!leagueGames.length) return;
      try {
        schedules.set(
          league,
          await fetchEspnSchedule(
            league,
            leagueGames.map((game) => game.commence_time),
            true,
            0
          )
        );
      } catch {
        schedules.set(league, []);
      }
    }));

    const games = [];
    let needsFinalization = false;

    for (const game of candidates || []) {
      const match = findEspnScheduleMatch(game, schedules.get(game.league) || []);
      if (!match || match.game.homeScore == null || match.game.awayScore == null) continue;

      const homeScore = match.swapped ? match.game.awayScore : match.game.homeScore;
      const awayScore = match.swapped ? match.game.homeScore : match.game.awayScore;
      const possessionTeam = match.game.possessionSide === "home"
        ? (match.swapped ? game.away_team : game.home_team)
        : match.game.possessionSide === "away"
          ? (match.swapped ? game.home_team : game.away_team)
          : null;
      const homeTimeouts = match.swapped ? match.game.awayTimeouts : match.game.homeTimeouts;
      const awayTimeouts = match.swapped ? match.game.homeTimeouts : match.game.awayTimeouts;

      if (match.game.completed) needsFinalization = true;

      games.push({
        id: game.id,
        final_home_score: match.game.completed ? homeScore : null,
        final_away_score: match.game.completed ? awayScore : null,
        live_home_score: homeScore,
        live_away_score: awayScore,
        live_status: match.game.statusDetail,
        live_state: match.game.statusState,
        live_completed: match.game.completed,
        live_possession_team: possessionTeam,
        live_situation: match.game.situationText,
        live_red_zone: match.game.redZone,
        live_down: match.game.down,
        live_distance: match.game.distance,
        live_yards_to_goal: match.game.yardsToGoal,
        live_home_timeouts: homeTimeouts,
        live_away_timeouts: awayTimeouts
      });
    }

    return NextResponse.json(
      { ok: true, games, needsFinalization },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not load live scores." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
