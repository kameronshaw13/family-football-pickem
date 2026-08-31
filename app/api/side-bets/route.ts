import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { requestedGroupFromRequest, resolveGroupContext } from "@/lib/groupContext";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { GET as baseGET, POST as basePOST } from "./routeBase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = baseGET;

export async function POST(req: NextRequest) {
  let body: any = null;
  try {
    body = await req.clone().json();
  } catch {
    return basePOST(req);
  }

  if (body?.action !== "clear" || typeof body?.sideBetId !== "string") return basePOST(req);

  try {
    const auth = await getProfileFromRequest(req);
    if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const supabase = getSupabaseAdmin();
    const context = await resolveGroupContext(supabase, auth.profile.id, requestedGroupFromRequest(req));
    const { data: sideBet, error } = await supabase
      .from("side_bets")
      .select("id,creator_id,week,status,targets:side_bet_targets(recipient_id)")
      .eq("group_id", context.group.id)
      .eq("season_year", context.seasonYear)
      .eq("id", body.sideBetId)
      .maybeSingle();

    if (error || !sideBet || sideBet.status !== "expired") return basePOST(req);
    const involved = sideBet.creator_id === auth.profile.id || sideBet.targets?.some((target: any) => target.recipient_id === auth.profile.id);
    if (!involved) return NextResponse.json({ ok: false, error: "This offer is not in your history." }, { status: 403 });

    const { error: dismissError } = await supabase.from("side_bet_dismissals").upsert({
      side_bet_id: sideBet.id,
      user_id: auth.profile.id,
      group_id: context.group.id,
      created_at: new Date().toISOString()
    }, { onConflict: "side_bet_id,user_id,group_id" });
    if (dismissError) throw dismissError;

    const url = new URL(req.url);
    url.search = "";
    url.searchParams.set("week", String(body.viewWeek ?? sideBet.week));
    return baseGET(new NextRequest(url, { method: "GET", headers: req.headers }));
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
