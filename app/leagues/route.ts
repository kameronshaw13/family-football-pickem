import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { listActiveGroupsForProfile } from "@/lib/groupContext";
import { accessibleLeaguesForUser, defaultLeagueForLaunch } from "@/lib/leagueAccess";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { DEFAULT_LEAGUE_COOKIE, setDefaultLeagueCookie } from "@/lib/defaultLeagueCookie";
import { isPickemAppSlug } from "@/lib/appIdentity";

export const dynamic = "force-dynamic";

/** Direct server redirect: no chooser, remembered league, or client loading splash. */
export async function GET(req: NextRequest) {
  try {
    // Reuse the verified default from a previous authorized login/membership
    // lookup. This avoids repeated database calls on every PWA launch.
    const session = req.cookies.get("pickem_session")?.value;
    const cachedDefault = req.cookies.get(DEFAULT_LEAGUE_COOKIE)?.value;
    if (session && isPickemAppSlug(cachedDefault)) {
      return NextResponse.redirect(new URL(
        cachedDefault === "shaw-family" ? "/" : cachedDefault === "other-family" ? "/caleb-family" : `/${cachedDefault}`,
        req.url
      ), 307);
    }

    const auth = await getProfileFromRequest(req);
    if (!auth.profile) return NextResponse.redirect(new URL("/leagues/login", req.url), 307);
    const groups = await listActiveGroupsForProfile(getSupabaseAdmin(), auth.profile.id);
    const leagues = accessibleLeaguesForUser(auth.profile.username || "", groups);
    const league = defaultLeagueForLaunch(leagues);
    if (!league) return new NextResponse("No active Pick'em leagues are assigned to this account.", {
      status: 403, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" }
    });
    const response = NextResponse.redirect(new URL(league.homePath, req.url), 307);
    setDefaultLeagueCookie(response, league.slug);
    return response;
  } catch (error) {
    console.error("Could not resolve default Pick'em league", error);
    return new NextResponse("Could not open your Pick'em league. Please try again.", {
      status: 503, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}
