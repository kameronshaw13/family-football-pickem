import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { gradeAgainstSpread, gradeUnderdogOutright } from "@/lib/spreads";

const schema = z.object({ gameId: z.string(), homeScore: z.number(), awayScore: z.number(), secret: z.string().optional() });

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    if (!process.env.CRON_SECRET || body.secret !== process.env.CRON_SECRET) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin();
    const { data: game, error: gameErr } = await supabase.from("games").select("*").eq("id", body.gameId).single();
    if (gameErr) return NextResponse.json({ ok: false, error: gameErr.message }, { status: 404 });

    await supabase.from("games").update({ final_home_score: body.homeScore, final_away_score: body.awayScore, updated_at: new Date().toISOString() }).eq("id", body.gameId);

    const { data: picks, error: pickErr } = await supabase.from("picks").select("*").eq("game_id", body.gameId).eq("status", "locked");
    if (pickErr) return NextResponse.json({ ok: false, error: pickErr.message }, { status: 500 });

    let graded = 0;
    for (const pick of picks || []) {
      let result: "win" | "loss" | "push";
      if (pick.pick_type === "underdog") {
        result = gradeUnderdogOutright(pick.selected_team, game.home_team, game.away_team, body.homeScore, body.awayScore);
      } else {
        if (pick.locked_spread == null) continue;
        result = gradeAgainstSpread(pick.selected_team, game.home_team, game.away_team, body.homeScore, body.awayScore, Number(pick.locked_spread));
      }
      const { error } = await supabase.from("picks").update({ result, updated_at: new Date().toISOString() }).eq("id", pick.id);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      graded++;
    }

    const { data: sideBets, error: sideBetError } = await supabase.from("side_bets").select("*").eq("game_id", body.gameId).eq("status", "accepted");
    if (sideBetError) return NextResponse.json({ ok: false, error: sideBetError.message }, { status: 500 });

    let sideBetsGraded = 0;
    for (const sideBet of sideBets || []) {
      if (!sideBet.accepted_by) continue;
      const result = gradeAgainstSpread(sideBet.creator_team, game.home_team, game.away_team, body.homeScore, body.awayScore, Number(sideBet.creator_spread));
      const sideBetResult = result === "win" ? "creator_win" : result === "loss" ? "acceptor_win" : "push";
      const winnerId = result === "win" ? sideBet.creator_id : result === "loss" ? sideBet.accepted_by : null;
      const { error } = await supabase.from("side_bets").update({
        status: "settled",
        result: sideBetResult,
        winner_id: winnerId,
        updated_at: new Date().toISOString()
      }).eq("id", sideBet.id).eq("status", "accepted");
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      sideBetsGraded++;
    }

    return NextResponse.json({ ok: true, graded, sideBetsGraded });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
