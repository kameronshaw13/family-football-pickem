import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { listActiveGroupsForProfile } from "@/lib/groupContext";
import { accessibleLeaguesForUser, defaultLeagueForLaunch } from "@/lib/leagueAccess";
import { DEFAULT_LEAGUE_COOKIE, setDefaultLeagueCookie } from "@/lib/defaultLeagueCookie";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const auth = await getProfileFromRequest(req);
    if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status, headers: { "Cache-Control": "no-store" } });

    const groups = await listActiveGroupsForProfile(getSupabaseAdmin(), auth.profile.id);
    const leagues = accessibleLeaguesForUser(auth.profile.username || "", groups);
    const response = NextResponse.json({
      ok: true,
      profile: { id: auth.profile.id, username: auth.profile.username, displayName: auth.profile.display_name },
      leagues
    }, { headers: { "Cache-Control": "no-store" } });
    const preferred = req.cookies.get(DEFAULT_LEAGUE_COOKIE)?.value;
    const permitted = leagues.find(league => league.slug === preferred);
    setDefaultLeagueCookie(response, permitted?.slug || defaultLeagueForLaunch(leagues)?.slug || null);
    return response;
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not load leagues." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
