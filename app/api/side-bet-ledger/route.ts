import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { requestedGroupFromRequest, resolveGroupContext } from "@/lib/groupContext";
import { getPickWeekOpenTime } from "@/lib/lockRules";
import { isEligibleSeasonGame } from "@/lib/seasonRules";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 15;

export async function GET(req: NextRequest) {
  try {
    const auth = await getProfileFromRequest(req);
    if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const supabase = getSupabaseAdmin();
    const context = await resolveGroupContext(supabase, auth.profile.id, requestedGroupFromRequest(req));
    const requested = Number(req.nextUrl.searchParams.get("week") || req.cookies.get("pickem_view_week")?.value);
    let week = Number.isInteger(requested) ? requested : null;

    if (week == null) {
      const { data: games, error: gamesError } = await supabase.from("games").select("week,commence_time,league,home_team,away_team,current_spread_team,current_spread");
      if (gamesError) throw new Error(gamesError.message);
      const eligible = (games || []).filter((game: any) => isEligibleSeasonGame(game) && game.current_spread_team != null && game.current_spread != null);
      const weeks = Array.from(new Set(eligible.map((game: any) => Number(game.week)))).sort((a, b) => a - b);
      const now = new Date();
      const opened = weeks.filter((candidateWeek) => {
        const commenceTimes = eligible.filter((game: any) => Number(game.week) === candidateWeek).map((game: any) => game.commence_time);
        const openTime = getPickWeekOpenTime(candidateWeek, commenceTimes, context.group.timezone);
        return !openTime || openTime <= now;
      });
      week = opened[opened.length - 1] ?? weeks[0] ?? 0;
    }

    const { data, error } = await supabase
      .from("side_bets")
      .select("*, game:games(*), creator:profiles!side_bets_creator_id_fkey(id,display_name), accepted_by_profile:profiles!side_bets_accepted_by_fkey(id,display_name), targets:side_bet_targets(*, recipient:profiles!side_bet_targets_recipient_id_fkey(id,display_name))")
      .eq("group_id", context.group.id)
      .eq("season_year", context.seasonYear)
      .eq("week", week)
      .in("status", ["accepted", "settled"])
      .abortSignal(AbortSignal.timeout(12_000))
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, week, sideBetLedger: data || [] }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    const timedOut = error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: timedOut ? 504 : 500 });
  }
}
