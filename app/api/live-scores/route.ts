import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { fetchEspnSchedule, fetchEspnWinProbability, findEspnScheduleMatch } from "@/lib/espnSchedule";
import { finalizeGame } from "@/lib/finalizeGame";
import { lockDuePicks } from "@/lib/lockDuePicks";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import type { Game } from "@/lib/types";

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
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .eq("week", week);

    if (error) throw error;

    const now = Date.now();
    const candidates = (data || []).filter((game) => {
      const start = new Date(game.commence_time).getTime();
      return game.final_home_score == null &&
        game.final_away_score == null &&
        start <= now &&
        start >= now - 12 * 60 * 60 * 1000 &&
        (game.league === "CFB" || game.league === "NFL");
    });

    if (!candidates.length) {
      return NextResponse.json({ ok: true, games: [] }, { headers: NO_STORE_HEADERS });
    }

    const schedules = new Map<string, Awaited<ReturnType<typeof fetchEspnSchedule>>>();
    await Promise.all((["CFB", "NFL"] as const).map(async (league) => {
      const leagueGames = candidates.filter((game) => game.league === league);
      if (!leagueGames.length) return;
      try {
        schedules.set(league, await fetchEspnSchedule(
          league,
          leagueGames.map((game) => game.commence_time),
          10
        ));
      } catch {
        schedules.set(league, []);
      }
    }));

    const games = [];
    let resultsUpdated = false;
    await lockDuePicks(supabase);

    const matchedCandidates = candidates.flatMap((game) => {
      const match = findEspnScheduleMatch(game, schedules.get(game.league) || []);
      return match ? [{ game, match }] : [];
    });
    const candidateIds = matchedCandidates.map(({ game }) => game.id);
    const { data: dogPicks } = candidateIds.length
      ? await supabase.from("picks").select("game_id").eq("week", week).eq("pick_type", "underdog").in("game_id", candidateIds)
      : { data: [] };
    const dogGameIds = new Set((dogPicks || []).map((pick) => pick.game_id));
    const winProbabilities = new Map<string, Awaited<ReturnType<typeof fetchEspnWinProbability>>>();
    await Promise.all(matchedCandidates.filter(({ game }) => dogGameIds.has(game.id)).map(async ({ game, match }) => {
      try {
        winProbabilities.set(game.id, await fetchEspnWinProbability(game.league, match.game.id, 10));
      } catch {
        winProbabilities.set(game.id, null);
      }
    }));

    for (const { game, match } of matchedCandidates) {
      if (match.game.homeScore == null || match.game.awayScore == null) continue;
      const homeScore = match.swapped ? match.game.awayScore : match.game.homeScore;
      const awayScore = match.swapped ? match.game.homeScore : match.game.awayScore;
      const possessionTeam = match.game.possessionSide === "home"
        ? (match.swapped ? game.away_team : game.home_team)
        : match.game.possessionSide === "away"
          ? (match.swapped ? game.home_team : game.away_team)
          : null;
      const homeTimeouts = match.swapped ? match.game.awayTimeouts : match.game.homeTimeouts;
      const awayTimeouts = match.swapped ? match.game.homeTimeouts : match.game.awayTimeouts;
      const winProbability = winProbabilities.get(game.id);
      const homeWinProbability = winProbability ? (match.swapped ? winProbability.away : winProbability.home) : null;
      const awayWinProbability = winProbability ? (match.swapped ? winProbability.home : winProbability.away) : null;
      if (match.game.completed) {
        await finalizeGame(supabase, game as Game, homeScore, awayScore);
        resultsUpdated = true;
      }
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
        live_away_timeouts: awayTimeouts,
        live_home_win_probability: homeWinProbability,
        live_away_win_probability: awayWinProbability
      });
    }

    return NextResponse.json({ ok: true, games, resultsUpdated }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not load live scores." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
