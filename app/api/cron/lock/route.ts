import { NextRequest, NextResponse } from "next/server";
import { getGameLockTime } from "@/lib/lockRules";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { normalizeSpreadForSelectedTeam, underdogWinValue } from "@/lib/spreads";
import { hasChargers, isChargersTeam } from "@/lib/seasonRules";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized. CRON_SECRET is missing or does not match." }, { status: 401 });
}

export async function GET(req: NextRequest) {
  try {
    const secret = req.headers.get("authorization")?.replace("Bearer ", "") || req.nextUrl.searchParams.get("secret");
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return unauthorized();

    const supabase = getSupabaseAdmin();
    const currentTime = new Date();
    const now = currentTime.toISOString();

    const { data: games, error: gameErr } = await supabase.from("games").select("*").eq("is_locked", false);
    if (gameErr) return NextResponse.json({ ok: false, error: "Supabase select from games failed.", details: gameErr.message }, { status: 500 });

    let gamesLocked = 0;
    let picksLocked = 0;
    let picksRemoved = 0;

    for (const game of games || []) {
      const effectiveLockTime = getGameLockTime(game.commence_time);
      const effectiveLockTimeIso = effectiveLockTime.toISOString();
      if (effectiveLockTime > currentTime) {
        if (game.lock_time !== effectiveLockTimeIso) {
          const { error: syncError } = await supabase.from("games").update({ lock_time: effectiveLockTimeIso, updated_at: now }).eq("id", game.id);
          if (syncError) return NextResponse.json({ ok: false, error: "Supabase lock-time sync failed.", details: syncError.message }, { status: 500 });
        }
        continue;
      }

      const { error: updateGameErr } = await supabase.from("games").update({ is_locked: true, lock_time: effectiveLockTimeIso, updated_at: now }).eq("id", game.id);
      if (updateGameErr) return NextResponse.json({ ok: false, error: "Supabase update games failed.", details: updateGameErr.message }, { status: 500 });
      gamesLocked++;

      const { data: draftPicks, error: pickErr } = await supabase.from("picks").select("*").eq("game_id", game.id).eq("status", "draft");
      if (pickErr) return NextResponse.json({ ok: false, error: "Supabase select from picks failed.", details: pickErr.message }, { status: 500 });

      for (const pick of draftPicks || []) {
        if (hasChargers(game) || isChargersTeam(pick.selected_team)) {
          const { error } = await supabase.from("picks").delete().eq("id", pick.id).eq("status", "draft");
          if (error) return NextResponse.json({ ok: false, error: "Supabase delete Chargers pick failed.", details: error.message }, { status: 500 });
          picksRemoved++;
          continue;
        }
        const lockedSpread = normalizeSpreadForSelectedTeam(pick.selected_team, game.current_spread_team, game.current_spread);
        const dogValue = pick.pick_type === "underdog" ? underdogWinValue(lockedSpread) : null;
        const { error } = await supabase.from("picks").update({
          status: "locked",
          locked_at: now,
          locked_spread: lockedSpread,
          locked_spread_team: pick.selected_team,
          underdog_win_value: dogValue,
          updated_at: now
        }).eq("id", pick.id);
        if (error) return NextResponse.json({ ok: false, error: "Supabase update picks failed.", details: error.message }, { status: 500 });
        picksLocked++;
      }
    }

    return NextResponse.json({ ok: true, gamesLocked, picksLocked, picksRemoved });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Lock route crashed.", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
