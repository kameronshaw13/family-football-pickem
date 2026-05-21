import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { normalizeSpreadForSelectedTeam } from "@/lib/spreads";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized. CRON_SECRET is missing or does not match." }, { status: 401 });
}

export async function GET(req: NextRequest) {
  try {
    const secret = req.headers.get("authorization")?.replace("Bearer ", "") || req.nextUrl.searchParams.get("secret");
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return unauthorized();

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { data: games, error: gameErr } = await supabase
      .from("games")
      .select("*")
      .lte("lock_time", now)
      .eq("is_locked", false);

    if (gameErr) {
      return NextResponse.json(
        { ok: false, error: "Supabase select from games failed. Did you run supabase/schema.sql?", details: gameErr.message },
        { status: 500 }
      );
    }

    let gamesLocked = 0;
    let picksLocked = 0;

    for (const game of games || []) {
      const { error: updateGameErr } = await supabase.from("games").update({ is_locked: true, updated_at: now }).eq("id", game.id);
      if (updateGameErr) {
        return NextResponse.json({ ok: false, error: "Supabase update games failed.", details: updateGameErr.message }, { status: 500 });
      }
      gamesLocked++;

      const { data: draftPicks, error: pickErr } = await supabase
        .from("picks")
        .select("*")
        .eq("game_id", game.id)
        .eq("status", "draft");

      if (pickErr) {
        return NextResponse.json({ ok: false, error: "Supabase select from picks failed.", details: pickErr.message }, { status: 500 });
      }

      for (const pick of draftPicks || []) {
        const lockedSpread = normalizeSpreadForSelectedTeam(pick.selected_team, game.current_spread_team, game.current_spread);
        const { error } = await supabase
          .from("picks")
          .update({
            status: "locked",
            locked_at: now,
            locked_spread: lockedSpread,
            locked_spread_team: pick.selected_team,
            updated_at: now
          })
          .eq("id", pick.id);

        if (error) return NextResponse.json({ ok: false, error: "Supabase update picks failed.", details: error.message }, { status: 500 });
        picksLocked++;
      }
    }

    return NextResponse.json({ ok: true, gamesLocked, picksLocked });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Lock route crashed.",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
