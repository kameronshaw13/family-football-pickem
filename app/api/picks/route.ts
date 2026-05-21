import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { normalizeSpreadForSelectedTeam } from "@/lib/spreads";

const createPickSchema = z.object({ userId: z.string(), gameId: z.string(), selectedTeam: z.string() });
const lockPickSchema = z.object({ pickId: z.string(), userId: z.string() });

export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action;
  const supabase = getSupabaseAdmin();

  if (action === "draft") {
    const parsed = createPickSchema.parse(body);
    const { data: game, error: gameErr } = await supabase.from("games").select("*").eq("id", parsed.gameId).single();
    if (gameErr) throw gameErr;
    if (new Date(game.lock_time) <= new Date() || game.is_locked) return NextResponse.json({ error: "This game is closed and cannot be picked." }, { status: 409 });

    const { data: existingPicks, error: countErr } = await supabase.from("picks").select("id,status,game_id").eq("user_id", parsed.userId).eq("week", game.week);
    if (countErr) throw countErr;
    const existing = existingPicks?.find((p) => p.game_id === parsed.gameId);
    if (!existing && (existingPicks?.length || 0) >= 5) return NextResponse.json({ error: "You already have 5 picks." }, { status: 409 });
    if (existing?.status === "locked") return NextResponse.json({ error: "Locked picks cannot be changed." }, { status: 409 });

    const row = { user_id: parsed.userId, game_id: parsed.gameId, week: game.week, selected_team: parsed.selectedTeam, status: "draft", result: "pending" };
    const query = existing
      ? supabase.from("picks").update({ selected_team: parsed.selectedTeam, updated_at: new Date().toISOString() }).eq("id", existing.id).select().single()
      : supabase.from("picks").insert(row).select().single();
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ ok: true, pick: data });
  }

  if (action === "lock") {
    const parsed = lockPickSchema.parse(body);
    const { data: pick, error: pickErr } = await supabase.from("picks").select("*, games(*)").eq("id", parsed.pickId).eq("user_id", parsed.userId).single();
    if (pickErr) throw pickErr;
    if (pick.status === "locked") return NextResponse.json({ ok: true, pick });
    const game = pick.games;
    if (new Date(game.lock_time) <= new Date() || game.is_locked) return NextResponse.json({ error: "This game is already closed." }, { status: 409 });
    const lockedSpread = normalizeSpreadForSelectedTeam(pick.selected_team, game.current_spread_team, game.current_spread);
    const { data, error } = await supabase.from("picks").update({
      status: "locked",
      locked_at: new Date().toISOString(),
      locked_spread: lockedSpread,
      locked_spread_team: pick.selected_team,
      updated_at: new Date().toISOString()
    }).eq("id", parsed.pickId).select().single();
    if (error) throw error;
    return NextResponse.json({ ok: true, pick: data });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
