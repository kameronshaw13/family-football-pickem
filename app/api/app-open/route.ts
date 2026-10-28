import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { requestedGroupFromRequest, resolveGroupContext } from "@/lib/groupContext";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const OPEN_WINDOW_MS = 2 * 60 * 1000;
const TRACKED_GROUPS = ["shaw-family", "friends"] as const;

export async function GET(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (String(auth.profile.username).toLowerCase() !== "kameron") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const league = req.nextUrl.searchParams.get("league");
  if (league !== "shaw-family" && league !== "friends") {
    return NextResponse.json({ error: "Choose Shaw or Friends." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const context = await resolveGroupContext(supabase, auth.profile.id, league);
    if (context.group.slug !== league || !["owner", "admin"].includes(context.group.role)) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }
    const { data, error } = await supabase.from("app_open_events")
      .select("id,opened_at,profile:profiles(display_name)")
      .eq("group_id", context.group.id)
      .order("opened_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const visits = (data || []).map((row: any) => ({
      id: row.id,
      openedAt: row.opened_at,
      name: Array.isArray(row.profile) ? row.profile[0]?.display_name : row.profile?.display_name
    }));
    return NextResponse.json({ visits }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not load private app activity", error);
    return NextResponse.json({ error: "Could not load app activity." }, { status: 500 });
  }
}

/** Private activity log, never returned to another league member or the client. */
export async function POST(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const supabase = getSupabaseAdmin();
    const context = await resolveGroupContext(supabase, auth.profile.id, requestedGroupFromRequest(req));
    // Activity is recorded only for the two leagues Kameron requested, excluding his opens.
    if (!TRACKED_GROUPS.some((slug) => slug === context.group.slug) || String(auth.profile.username).toLowerCase() === "kameron") {
      return new NextResponse(null, { status: 204 });
    }

    const openWindow = new Date(Math.floor(Date.now() / OPEN_WINDOW_MS) * OPEN_WINDOW_MS).toISOString();
    const { error } = await supabase.from("app_open_events").upsert({
      group_id: context.group.id,
      profile_id: auth.profile.id,
      open_window: openWindow
    }, { onConflict: "group_id,profile_id,open_window", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Could not record Pick'em app open", error);
    return NextResponse.json({ error: "Could not record app open." }, { status: 500 });
  }
}
