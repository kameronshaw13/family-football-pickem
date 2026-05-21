import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getWeekRule } from "@/lib/weekRules";

async function getAuthedUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return { user: null, error: "Missing auth token." };
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { user: null, error: error?.message || "Invalid auth token." };
  return { user: data.user, error: null };
}

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await getAuthedUser(req);
    if (!user) return NextResponse.json({ ok: false, error }, { status: 401 });

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    const requestedWeek = req.nextUrl.searchParams.get("week");

    const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (profileError) return NextResponse.json({ ok: false, error: "Profile not found. Claim your account first." }, { status: 404 });

    const { data: allGames, error: gameError } = await supabase.from("games").select("*").order("commence_time", { ascending: true });
    if (gameError) return NextResponse.json({ ok: false, error: gameError.message }, { status: 500 });

    const openGames = (allGames || []).filter((g) => new Date(g.commence_time).getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000);
    const defaultWeek = openGames[0]?.week ?? allGames?.[0]?.week ?? 0;
    const week = requestedWeek != null ? Number(requestedWeek) : defaultWeek;

    const games = (allGames || []).filter((g) => g.week === week);

    const { data: profiles, error: profilesError } = await supabase.from("profiles").select("*").order("display_name", { ascending: true });
    if (profilesError) return NextResponse.json({ ok: false, error: profilesError.message }, { status: 500 });

    const { data: picks, error: picksError } = await supabase
      .from("picks")
      .select("*, game:games(*), profile:profiles(*)")
      .eq("week", week);
    if (picksError) return NextResponse.json({ ok: false, error: picksError.message }, { status: 500 });

    const visiblePicks = (picks || []).filter((pick: any) => {
      if (pick.user_id === user.id) return true;
      const game = pick.game;
      return game && new Date(game.lock_time).toISOString() <= now;
    });

    const { data: standings, error: standingError } = await supabase.from("standings").select("*").order("win_pct", { ascending: false }).order("wins", { ascending: false });
    if (standingError) return NextResponse.json({ ok: false, error: standingError.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      currentUser: profile,
      profiles: profiles || [],
      games,
      picks: visiblePicks,
      standings: standings || [],
      week,
      weekRule: getWeekRule(week),
      availableWeeks: Array.from(new Set((allGames || []).map((g) => g.week))).sort((a, b) => a - b)
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
