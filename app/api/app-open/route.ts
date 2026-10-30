import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { requestedGroupFromRequest, resolveGroupContext } from "@/lib/groupContext";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const dynamic = "force-dynamic";

const TRACKED_GROUPS = ["shaw-family", "friends", "friends-basketball"] as const;
const ZONE = "America/Chicago";

export async function GET(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (String(auth.profile.username).toLowerCase() !== "kameron") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const league = req.nextUrl.searchParams.get("league");
  if (league !== "shaw-family" && league !== "friends" && league !== "friends-basketball") {
    return NextResponse.json({ error: "Choose a tracked league." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const context = await resolveGroupContext(supabase, auth.profile.id, league);
    if (context.group.slug !== league) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }
    const today = formatInTimeZone(new Date(), ZONE, "yyyy-MM-dd");
    const since = fromZonedTime(`${today}T00:00:00`, ZONE).toISOString();
    const visits: { id: string; openedAt: string; name: string }[] = [];
    // Paginate so every recorded opening since midnight is included.
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.from("app_open_events")
        .select("id,opened_at,profile:profiles(display_name)")
        .eq("group_id", context.group.id)
        .gte("opened_at", since)
        .order("opened_at", { ascending: false })
        .range(offset, offset + 999);
      if (error) throw new Error(error.message);
      for (const row of data || []) {
        const profile = row.profile as unknown as { display_name?: string } | { display_name?: string }[] | null;
        visits.push({
          id: row.id,
          openedAt: row.opened_at,
          name: (Array.isArray(profile) ? profile[0]?.display_name : profile?.display_name) || "Player"
        });
      }
      if (!data || data.length < 1000) break;
    }
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
    // Activity is recorded only for the tracked leagues Kameron requested, excluding his opens.
    if (!TRACKED_GROUPS.some((slug) => slug === context.group.slug) || String(auth.profile.username).toLowerCase() === "kameron") {
      return new NextResponse(null, { status: 204 });
    }

    const openWindow = new Date().toISOString();
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
