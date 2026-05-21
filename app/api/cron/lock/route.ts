import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { normalizeSpreadForSelectedTeam } from "@/lib/spreads";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "") || req.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return unauthorized();

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: games, error: gameErr } = await supabase
    .from("games")
    .select("*")
    .lte("lock_time", now)
    .eq("is_locked", false);
  if (gameErr) throw gameErr;

  let gamesLocked = 0;
  let picksLocked = 0;

  for (const game of games || []) {
    const { error: updateGameErr } = await supabase.from("games").update({ is_locked: true, updated_at: now }).eq("id", game.id);
    if (updateGameErr) throw updateGameErr;
    gamesLocked++;

    const { data: draftPicks, error: pickErr } = await supabase
      .from("picks")
      .select("*")
      .eq("game_id", game.id)
      .eq("status", "draft");
    if (pickErr) throw pickErr;

    for (const pick of draftPicks || []) {
      const lockedSpread = normalizeSpreadForSelectedTeam(pick.selected_team, game.current_spread_team, game.current_spread);
      const { error } = await supabase.from("picks").update({
        status: "locked",
        locked_at: now,
        locked_spread: lockedSpread,
        locked_spread_team: pick.selected_team,
        updated_at: now
      }).eq("id", pick.id);
      if (error) throw error;
      picksLocked++;
    }
  }

  return NextResponse.json({ ok: true, gamesLocked, picksLocked });
}
