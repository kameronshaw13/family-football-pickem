import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { listActiveGroupsForProfile } from "@/lib/groupContext";
import { accessibleLeaguesForUser } from "@/lib/leagueAccess";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { setDefaultLeagueCookie } from "@/lib/defaultLeagueCookie";

export const dynamic = "force-dynamic";

/** Persist a launch destination only after verifying membership. */
export async function POST(req: NextRequest) {
  try {
    const auth = await getProfileFromRequest(req);
    if (!auth.profile) return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
    const body = await req.json();
    const slug = typeof body?.slug === "string" ? body.slug : "";
    const groups = await listActiveGroupsForProfile(getSupabaseAdmin(), auth.profile.id);
    const permitted = accessibleLeaguesForUser(auth.profile.username || "", groups).find(league => league.slug === slug);
    if (!permitted) return NextResponse.json({ ok: false, error: "League is not available to this account." }, { status: 403 });
    const { error: saveError } = await getSupabaseAdmin().from("profiles").update({ default_league_slug: permitted.slug }).eq("id", auth.profile.id);
    if (saveError) throw saveError;
    const response = NextResponse.json({ ok: true, slug: permitted.slug }, { headers: { "Cache-Control": "no-store" } });
    setDefaultLeagueCookie(response, permitted.slug);
    return response;
  } catch {
    return NextResponse.json({ ok: false, error: "Could not save default league." }, { status: 500 });
  }
}
