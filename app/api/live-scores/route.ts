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
    const { data, error } = await supabase
      .from("games")
      .select("id,week,league,commence_time,home_team,away_team,final_home_score,final_away_score")
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
          true
        ));
      } catch {
        schedules.set(league, []);
      }
    }));

    const games = candidates.flatMap((game) => {
      const match = findEspnScheduleMatch(game, schedules.get(game.league) || []);
      if (!match || match.game.homeScore == null || match.game.awayScore == null) return [];
      return [{
        id: game.id,
        live_home_score: match.swapped ? match.game.awayScore : match.game.homeScore,
        live_away_score: match.swapped ? match.game.homeScore : match.game.awayScore,
        live_status: match.game.statusDetail,
        live_state: match.game.statusState,
        live_completed: match.game.completed
      }];
    });

    return NextResponse.json({ ok: true, games }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not load live scores." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
