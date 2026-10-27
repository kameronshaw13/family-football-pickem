import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { isGameAllowedForGroup, requestedGroupFromRequest, resolveGroupContext } from "@/lib/groupContext";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { loadTorvikSeason } from "@/lib/torvikServer";
import { findTorvikTeam, torvikSeason } from "@/lib/torvikData";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile) return NextResponse.json({ error: auth.error }, { status: auth.status, headers });
  const id = req.nextUrl.searchParams.get("gameId");
  if (!id || id.length > 120) return NextResponse.json({ error: "Choose a valid game." }, { status: 400, headers });
  try {
    const supabase = getSupabaseAdmin();
    const context = await resolveGroupContext(supabase, auth.profile.id, requestedGroupFromRequest(req));
    const { data: game, error } = await supabase.from("games").select("id,league,week,commence_time,away_team,home_team").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!game || game.league !== "CBB" || !isGameAllowedForGroup(context, game)) return NextResponse.json({ error: "College basketball game not found." }, { status: 404, headers });
    const year = torvikSeason(game.commence_time);
    const season = await loadTorvikSeason(year);
    return NextResponse.json({ year, fetchedAt: season.fetchedAt, stale: season.stale, factorsAvailable: season.factorsAvailable, teams: { away: findTorvikTeam(season.teams, game.away_team), home: findTorvikTeam(season.teams, game.home_team) } }, { headers });
  } catch {
    return NextResponse.json({ error: "Advanced stats are temporarily unavailable." }, { status: 503, headers });
  }
}
