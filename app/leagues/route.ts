import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { listActiveGroupsForProfile } from "@/lib/groupContext";
import { accessibleLeaguesForUser, defaultLeagueForLaunch } from "@/lib/leagueAccess";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

/** Direct server redirect: no chooser, remembered league, or client loading splash. */
export async function GET(req: NextRequest) {
  try {
    const auth = await getProfileFromRequest(req);
    if (!auth.profile) return NextResponse.redirect(new URL("/leagues/login", req.url), 307);
    const groups = await listActiveGroupsForProfile(getSupabaseAdmin(), auth.profile.id);
    const leagues = accessibleLeaguesForUser(auth.profile.username || "", groups);
    const league = defaultLeagueForLaunch(leagues);
    if (!league) return new NextResponse("No active Pick'em leagues are assigned to this account.", {
      status: 403, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" }
    });
    return NextResponse.redirect(new URL(league.homePath, req.url), 307);
  } catch (error) {
    console.error("Could not resolve default Pick'em league", error);
    return new NextResponse("Could not open your Pick'em league. Please try again.", {
      status: 503, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}
