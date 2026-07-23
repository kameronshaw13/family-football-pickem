import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getPickWeekOpenTime } from "@/lib/lockRules";
import { getWeekRule } from "@/lib/weekRules";
import { getProfileFromToken } from "@/lib/authServer";
import { hasChargers, isEligibleRegularSeasonGame } from "@/lib/seasonRules";
import { computeWeeklyStandings } from "@/lib/weeklyBank";

async function getAuthedProfile(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return { profile: null, error: "Missing auth token." };
  const profile = await getProfileFromToken(token);
  if (!profile) return { profile: null, error: "Invalid or expired session." };
  return { profile, error: null };
}

export async function GET(req: NextRequest) {
  try {
    const { profile, error } = await getAuthedProfile(req);
    if (!profile) return NextResponse.json({ ok: false, error }, { status: 401 });

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    const requestedWeek = req.nextUrl.searchParams.get("week");

    const { data: rawGames, error: gameError } = await supabase.from("games").select("*").order("commence_time", { ascending: true });
    if (gameError) return NextResponse.json({ ok: false, error: gameError.message }, { status: 500 });
    const allGames = (rawGames || []).filter((game) => isEligibleRegularSeasonGame(game) && !hasChargers(game));

    const openGames = allGames.filter((g) => new Date(g.commence_time).getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000);
    const defaultWeek = openGames[0]?.week ?? allGames?.[0]?.week ?? 0;
    const week = requestedWeek != null ? Number(requestedWeek) : defaultWeek;
    const games = allGames.filter((g) => g.week === week);
    const weekOpen = getPickWeekOpenTime(week, games.map((g) => g.commence_time));

    const { data: profiles, error: profilesError } = await supabase.from("profiles").select("*").order("display_name", { ascending: true });
    if (profilesError) return NextResponse.json({ ok: false, error: profilesError.message }, { status: 500 });

    const { data: picks, error: picksError } = await supabase
      .from("picks")
      .select("*, game:games(*), profile:profiles(*)")
      .eq("week", week);
    if (picksError) return NextResponse.json({ ok: false, error: picksError.message }, { status: 500 });

    const { data: allLockedPicks, error: allLockedPicksError } = await supabase
      .from("picks")
      .select("user_id,week,pick_type,status,result,underdog_win_value")
      .eq("status", "locked");
    if (allLockedPicksError) return NextResponse.json({ ok: false, error: allLockedPicksError.message }, { status: 500 });
    const standingsWeeks = Array.from(new Set(allGames.map((game) => Number(game.week))));
    const weeklyStandingsByWeek = Object.fromEntries(standingsWeeks.map((standingWeek) => [
      String(standingWeek),
      computeWeeklyStandings(profiles || [], (allLockedPicks || []).filter((pick) => Number(pick.week) === standingWeek) as any)
    ]));

    const visiblePicks = (picks || []).filter((pick: any) => {
      const game = pick.game;
      if (!game || !isEligibleRegularSeasonGame(game) || hasChargers(game)) return false;
      if (pick.user_id === profile.id) return true;
      return new Date(game.lock_time).toISOString() <= now;
    });

    const { data: standings, error: standingError } = await supabase.from("standings").select("*").order("win_pct", { ascending: false }).order("wins", { ascending: false });
    if (standingError) return NextResponse.json({ ok: false, error: standingError.message }, { status: 500 });

    const { data: bankSettings, error: bankSettingsError } = await supabase.from("bank_settings").select("*").eq("id", 1).maybeSingle();
    if (bankSettingsError) return NextResponse.json({ ok: false, error: bankSettingsError.message }, { status: 500 });

    const { data: bankEntries, error: bankEntriesError } = await supabase
      .from("bank_entries")
      .select("*, profile:profiles(display_name)")
      .order("week", { ascending: false })
      .order("created_at", { ascending: false });
    if (bankEntriesError) return NextResponse.json({ ok: false, error: bankEntriesError.message }, { status: 500 });

    const { data: allSideBets, error: sideBetError } = await supabase
      .from("side_bets")
      .select("*, game:games(*), creator:profiles!side_bets_creator_id_fkey(id,display_name), accepted_by_profile:profiles!side_bets_accepted_by_fkey(id,display_name), targets:side_bet_targets(*, recipient:profiles!side_bet_targets_recipient_id_fkey(id,display_name))")
      .order("created_at", { ascending: false });
    if (sideBetError) return NextResponse.json({ ok: false, error: `${sideBetError.message} Run the updated Supabase schema before using side bets.` }, { status: 500 });

    const expiredIds = (allSideBets || [])
      .filter((bet: any) => bet.status === "open" && bet.game && new Date(bet.game.commence_time) <= new Date())
      .map((bet: any) => bet.id);
    if (expiredIds.length) {
      await supabase.from("side_bets").update({ status: "expired", updated_at: now }).in("id", expiredIds).eq("status", "open");
      await supabase.from("side_bet_targets").update({ response: "closed", responded_at: now }).in("side_bet_id", expiredIds).eq("response", "pending");
    }

    const sideBets = (allSideBets || []).filter((bet: any) =>
      bet.creator_id === profile.id || bet.accepted_by === profile.id || bet.targets?.some((target: any) => target.recipient_id === profile.id)
    ).map((bet: any) => expiredIds.includes(bet.id) ? { ...bet, status: "expired" } : bet);

    const sideBetBankTotals = Object.fromEntries((profiles || []).map((player: any) => [player.id, 0]));
    for (const bet of allSideBets || []) {
      if (bet.status !== "settled" || bet.result === "push" || !bet.accepted_by || !bet.winner_id) continue;
      const loserId = bet.winner_id === bet.creator_id ? bet.accepted_by : bet.creator_id;
      sideBetBankTotals[bet.winner_id] = Number(sideBetBankTotals[bet.winner_id] || 0) + Number(bet.amount);
      sideBetBankTotals[loserId] = Number(sideBetBankTotals[loserId] || 0) - Number(bet.amount);
    }

    return NextResponse.json({
      ok: true,
      currentUser: profile,
      profiles: profiles || [],
      games,
      picks: visiblePicks,
      standings: standings || [],
      weeklyStandingsByWeek,
      bankSettings: bankSettings || { id: 1, winner_amount: 20, loser_amount: 10 },
      bankEntries: bankEntries || [],
      sideBets,
      sideBetBankTotals,
      week,
      weekRule: getWeekRule(week),
      weekOpenTime: weekOpen ? weekOpen.toISOString() : null,
      availableWeeks: Array.from(new Set(allGames.map((g) => g.week))).sort((a, b) => a - b)
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
