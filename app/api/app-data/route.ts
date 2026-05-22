import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getWeekOpenTimeFromCommenceTimes } from "@/lib/lockRules";
import { getWeekRule } from "@/lib/weekRules";
import { getProfileFromToken } from "@/lib/authServer";

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

    const { data: allGames, error: gameError } = await supabase.from("games").select("*").order("commence_time", { ascending: true });
    if (gameError) return NextResponse.json({ ok: false, error: gameError.message }, { status: 500 });

    const openGames = (allGames || []).filter((g) => new Date(g.commence_time).getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000);
    const defaultWeek = openGames[0]?.week ?? allGames?.[0]?.week ?? 0;
    const week = requestedWeek != null ? Number(requestedWeek) : defaultWeek;
    const games = (allGames || []).filter((g) => g.week === week);
    const weekOpen = getWeekOpenTimeFromCommenceTimes(games.map((g) => g.commence_time));

    const { data: profiles, error: profilesError } = await supabase.from("profiles").select("*").order("display_name", { ascending: true });
    if (profilesError) return NextResponse.json({ ok: false, error: profilesError.message }, { status: 500 });

    const { data: picks, error: picksError } = await supabase
      .from("picks")
      .select("*, game:games(*), profile:profiles(*)")
      .eq("week", week);
    if (picksError) return NextResponse.json({ ok: false, error: picksError.message }, { status: 500 });

    const visiblePicks = (picks || []).filter((pick: any) => {
      if (pick.user_id === profile.id) return true;
      const game = pick.game;
      return game && new Date(game.lock_time).toISOString() <= now;
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

    return NextResponse.json({
      ok: true,
      currentUser: profile,
      profiles: profiles || [],
      games,
      picks: visiblePicks,
      standings: standings || [],
      bankSettings: bankSettings || { id: 1, winner_amount: 20, loser_amount: 10 },
      bankEntries: bankEntries || [],
      week,
      weekRule: getWeekRule(week),
      weekOpenTime: weekOpen ? weekOpen.toISOString() : null,
      availableWeeks: Array.from(new Set((allGames || []).map((g) => g.week))).sort((a, b) => a - b)
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
