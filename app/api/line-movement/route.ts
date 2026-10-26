import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { buildLineMovement } from "@/lib/lineMovement";
import { createAsyncCache } from "@/lib/asyncCache";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;
const cached = createAsyncCache<ReturnType<typeof buildLineMovement>>(30_000, 64);

export async function GET(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const gameId = req.nextUrl.searchParams.get("gameId");
  if (!gameId || gameId.length > 120) return NextResponse.json({ error: "Choose a valid game." }, { status: 400 });
  try {
    const supabase = getSupabaseAdmin();
    const result = await supabase.from("games").select("id,league,espn_event_id,commence_time,away_team,home_team")
      .eq("id", gameId).in("league", ["NFL", "CFB"]).maybeSingle();
    if (result.error) throw result.error;
    const game = result.data;
    if (!game) return NextResponse.json({ error: "Game not found." }, { status: 404 });
    const points = await cached(game.id, async () => {
      const queries = [supabase.from("games").select("id").eq("league", game.league).eq("commence_time", game.commence_time).eq("home_team", game.home_team).eq("away_team", game.away_team)];
      if (game.espn_event_id) queries.push(supabase.from("games").select("id").eq("league", game.league).eq("espn_event_id", game.espn_event_id));
      const aliases = await Promise.all(queries);
      for (const alias of aliases) if (alias.error) throw alias.error;
      const ids = [...new Set([game.id, ...aliases.flatMap(alias => (alias.data || []).map(row => row.id))])];
      const rows = [];
      for (let offset = 0; ; offset += 1000) {
        const page = await supabase.from("odds_snapshots").select("id,spread_team,spread,created_at")
          .in("game_id", ids).eq("bookmaker", "DraftKings").order("created_at").order("id").range(offset, offset + 999)
          .abortSignal(AbortSignal.timeout(8000));
        if (page.error) throw page.error;
        rows.push(...(page.data || []));
        if ((page.data || []).length < 1000) break;
      }
      return buildLineMovement(rows, game.away_team);
    });
    return NextResponse.json({ points }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Line movement is temporarily unavailable." }, { status: 503 });
  }
}
