import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { getActionNetworkQuotes } from "@/lib/actionNetworkOdds";
import { isGameAllowedForGroup, requestedGroupFromRequest, resolveGroupContext } from "@/lib/groupContext";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

export async function GET(req: NextRequest) {
  try {
    const auth = await getProfileFromRequest(req);
    if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status, headers: NO_STORE_HEADERS });

    const week = Number(req.nextUrl.searchParams.get("week"));
    if (!Number.isInteger(week) || week < 0) {
      return NextResponse.json({ ok: false, error: "A valid week is required." }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const supabase = getSupabaseAdmin();
    const context = await resolveGroupContext(supabase, auth.profile.id, requestedGroupFromRequest(req));
    const { data: games, error } = await supabase
      .from("games")
      .select("id,week,league,commence_time,home_team,away_team,current_spread_team,current_spread,final_home_score,final_away_score")
      .eq("week", week)
      .in("league", ["CFB", "NFL"]);
    if (error) throw new Error(error.message);

    const allowed = (games || []).filter((game: any) =>
      isGameAllowedForGroup(context, game) &&
      game.final_home_score == null &&
      game.final_away_score == null
    );
    const quotes = await getActionNetworkQuotes(allowed as any[], { fresh: req.nextUrl.searchParams.get("fresh") === "1" });
    return NextResponse.json({ ok: true, quotes }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not load side bet markets." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
