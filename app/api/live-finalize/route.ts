import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { fetchEspnSchedule, findEspnScheduleMatch } from "@/lib/espnSchedule";
import { finalizeGame } from "@/lib/finalizeGame";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import type { Game, League } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

export async function POST(req: NextRequest) {
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
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .eq("week", week)
      .or("final_home_score.is.null,final_away_score.is.null");

    if (error) throw error;

    const candidates = ((data || []) as Game[]).filter((game) => {
      const start = new Date(game.commence_time).getTime();
      return start <= now &&
        start >= now - 24 * 60 * 60 * 1000 &&
        (game.league === "CFB" || game.league === "NFL");
    });

    if (!candidates.length) {
      return NextResponse.json(
        { ok: true, resultsUpdated: false, gamesFinalized: 0 },
        { headers: NO_STORE_HEADERS }
      );
    }

    const schedules = new Map<string, Awaited<ReturnType<typeof fetchEspnSchedule>>>();
    await Promise.all((["CFB", "NFL"] as const).map(async (league) => {
      const leagueGames = candidates.filter((game) => game.league === league);
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

    let gamesFinalized = 0;
    for (const league of ["CFB", "NFL"] as League[]) {
      const leagueGames = candidates.filter((game) => game.league === league);
      const schedule = schedules.get(league) || [];
      for (const game of leagueGames) {
        const match = findEspnScheduleMatch(game, schedule);
        if (!match?.game.completed || match.game.homeScore == null || match.game.awayScore == null) continue;
        const homeScore = match.swapped ? match.game.awayScore : match.game.homeScore;
        const awayScore = match.swapped ? match.game.homeScore : match.game.awayScore;
        await finalizeGame(supabase, game, homeScore, awayScore);
        gamesFinalized += 1;
      }
    }

    return NextResponse.json(
      { ok: true, resultsUpdated: gamesFinalized > 0, gamesFinalized },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not finalize live results." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
