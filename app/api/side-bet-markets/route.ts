import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { fetchActionNetworkMarkets } from "@/lib/actionNetworkMarkets";
import { persistActionNetworkSpreads } from "@/lib/footballMarketSync";
import { isGameAllowedForGroup, requestedGroupFromRequest, resolveGroupContext } from "@/lib/groupContext";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

export async function GET(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status, headers: NO_STORE_HEADERS });
  }

  const week = Number(req.nextUrl.searchParams.get("week"));
  if (!Number.isInteger(week) || week < 0) {
    return NextResponse.json({ ok: false, error: "A valid week is required." }, { status: 400, headers: NO_STORE_HEADERS });
  }

  try {
    const supabase = getSupabaseAdmin();
    const context = await resolveGroupContext(supabase, auth.profile.id, requestedGroupFromRequest(req));
    const { data: games, error } = await supabase
      .from("games")
      .select("*")
      .eq("week", week)
      .in("league", ["CFB", "NFL"])
      .order("commence_time", { ascending: true });
    if (error) throw new Error(error.message);

    const eligible = (games || []).filter((game) => isGameAllowedForGroup(context, game));
    const markets = await fetchActionNetworkMarkets(eligible);
    const persisted = await persistActionNetworkSpreads(supabase, eligible, markets, new Date());
    return NextResponse.json({ ok: true, markets, gamesUpdated: persisted.gamesUpdated }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not load side bet markets." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
