import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { settleWeekIfReady } from "@/lib/autoSettlement";
import { fetchEspnSchedule, resolveEspnScheduleMatch } from "@/lib/espnSchedule";
import { finalizeGame } from "@/lib/finalizeGame";
import { lockDuePicks } from "@/lib/lockDuePicks";
import { retryPendingPushNotifications } from "@/lib/notifications";
import { settleSeasonIfReady } from "@/lib/seasonSettlement";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import type { Game, League } from "@/lib/types";

const SUPABASE_RESULTS_CRON_TOKEN_SHA256 = "3907027700258fc50a7d4ea237b41402793ca1082da70fdc5751a81216c09dbb";

function hasValidSupabaseCronToken(req: NextRequest) {
  const token = req.headers.get("x-odds-cron-token");
  if (!token) return false;
  const actual = Buffer.from(createHash("sha256").update(token).digest("hex"), "hex");
  const expectedHash = process.env.ODDS_CRON_TOKEN_SHA256 || SUPABASE_RESULTS_CRON_TOKEN_SHA256;
  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  try {
    const secret = req.headers.get("authorization")?.replace("Bearer ", "") || req.nextUrl.searchParams.get("secret");
    const hasValidVercelSecret = Boolean(process.env.CRON_SECRET && secret === process.env.CRON_SECRET);
    const hasValidSupabaseSecret = hasValidSupabaseCronToken(req);
    if (!hasValidVercelSecret && !hasValidSupabaseSecret) return unauthorized();

    const isVercelScheduledRun = Boolean(req.headers.get("x-vercel-cron-schedule"));
    const supabase = getSupabaseAdmin();
    const lockResult = await lockDuePicks(supabase);
    let pushRetry = { attempted: 0, sent: 0, failed: 0 };
    try {
      // The immediate send already retries once. This second pass catches transient
      // provider/network failures without ever blocking grading if push is unhealthy.
      pushRetry = await retryPendingPushNotifications(supabase, 8);
    } catch (error) {
      console.error("Pending push retry pass failed", error);
    }
    const now = new Date();
    // The frequent Supabase cron only needs to finalize games from the current
    // live window. The once-daily Vercel cron remains a deeper recovery pass.
    const lookbackMs = (isVercelScheduledRun ? 10 * 24 : 36) * 60 * 60 * 1000;
    const oldestRelevantKickoff = new Date(now.getTime() - lookbackMs).toISOString();
    const [{ data, error }, { data: recentWeekRows, error: recentWeekError }] = await Promise.all([
      supabase
        .from("games")
        .select("*")
        .gte("commence_time", oldestRelevantKickoff)
        .lte("commence_time", now.toISOString())
        .or("final_home_score.is.null,final_away_score.is.null")
        .order("commence_time", { ascending: true }),
      supabase
        .from("games")
        .select("week")
        .gte("commence_time", oldestRelevantKickoff)
        .lte("commence_time", now.toISOString())
    ]);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (recentWeekError) return NextResponse.json({ ok: false, error: recentWeekError.message }, { status: 500 });

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
        const match = await resolveEspnScheduleMatch(game, schedule, league, { freshness: true });
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

    // Settlement must be retried even when the final scores were already stored
    // in an earlier run. Otherwise a week that was temporarily blocked by a
    // stranded/pending pick can remain unfinalized forever after that pick is fixed.
    const weeksToSettle = new Set<number>([
      ...Array.from(weeksFinalized),
      ...(recentWeekRows || []).map((row: any) => Number(row.week)).filter((week: number) => Number.isInteger(week) && week >= 0)
    ]);
    for (const week of Array.from(weeksToSettle)) {
      const settlement = await settleWeekIfReady(supabase, week);
      if (settlement.settled) weeksSettled.add(week);
    }
    const seasonSettlement = await settleSeasonIfReady(supabase, now);

    return NextResponse.json({
      ok: true,
      gamesChecked: games.length,
      lookbackHours: Math.round(lookbackMs / (60 * 60 * 1000)),
      ...lockResult,
      gamesFinalized,
      picksGraded,
      sideBetsGraded,
      pushRetry,
      weeksCheckedForSettlement: Array.from(weeksToSettle),
      weeksSettled: Array.from(weeksSettled),
      seasonSettled: seasonSettlement.settled,
      seasonSettlementReason: seasonSettlement.reason || null
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
