import { NextRequest, NextResponse } from "next/server";
import { settleWeekIfReady } from "@/lib/autoSettlement";
import { fetchEspnSchedule, findEspnScheduleMatch } from "@/lib/espnSchedule";
import { finalizeGame } from "@/lib/finalizeGame";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import type { Game, League } from "@/lib/types";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  try {
    const secret = req.headers.get("authorization")?.replace("Bearer ", "") || req.nextUrl.searchParams.get("secret");
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return unauthorized();

    const supabase = getSupabaseAdmin();
    const now = new Date();
    const oldestRelevantKickoff = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .gte("commence_time", oldestRelevantKickoff)
      .lte("commence_time", now.toISOString())
      .or("final_home_score.is.null,final_away_score.is.null")
      .order("commence_time", { ascending: true });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const games = (data || []) as Game[];
    let gamesFinalized = 0;
    let picksGraded = 0;
    let sideBetsGraded = 0;
    const weeksFinalized = new Set<number>();
    const weeksSettled = new Set<number>();

    for (const league of ["CFB", "NFL"] as League[]) {
      const leagueGames = games.filter((game) => game.league === league);
      if (!leagueGames.length) continue;
      const schedule = await fetchEspnSchedule(league, leagueGames.map((game) => game.commence_time), true);

      for (const game of leagueGames) {
        const match = findEspnScheduleMatch(game, schedule);
        if (!match?.game.completed || match.game.homeScore == null || match.game.awayScore == null) continue;
        const homeScore = match.swapped ? match.game.awayScore : match.game.homeScore;
        const awayScore = match.swapped ? match.game.homeScore : match.game.awayScore;
        const finalized = await finalizeGame(supabase, game, homeScore, awayScore, false);
        gamesFinalized++;
        picksGraded += finalized.picksGraded;
        sideBetsGraded += finalized.sideBetsGraded;
        weeksFinalized.add(Number(game.week));
      }
    }

    for (const week of Array.from(weeksFinalized)) {
      const settlement = await settleWeekIfReady(supabase, week);
      if (settlement.settled) weeksSettled.add(week);
    }

    return NextResponse.json({
      ok: true,
      gamesChecked: games.length,
      gamesFinalized,
      picksGraded,
      sideBetsGraded,
      weeksSettled: Array.from(weeksSettled)
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
