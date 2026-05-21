import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { gradeAgainstSpread } from "@/lib/spreads";

const schema = z.object({ gameId: z.string(), homeScore: z.number(), awayScore: z.number(), secret: z.string().optional() });

export async function POST(req: NextRequest) {
  const body = schema.parse(await req.json());
  if (!process.env.CRON_SECRET || body.secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseAdmin();
  const { data: game, error: gameErr } = await supabase.from("games").select("*").eq("id", body.gameId).single();
  if (gameErr) throw gameErr;
  await supabase.from("games").update({ final_home_score: body.homeScore, final_away_score: body.awayScore, updated_at: new Date().toISOString() }).eq("id", body.gameId);

  const { data: picks, error: pickErr } = await supabase.from("picks").select("*").eq("game_id", body.gameId).eq("status", "locked");
  if (pickErr) throw pickErr;
  for (const pick of picks || []) {
    if (pick.locked_spread == null || !pick.locked_spread_team) continue;
    const result = gradeAgainstSpread({
      selectedTeam: pick.selected_team,
      lockedSpreadTeam: pick.locked_spread_team,
      lockedSpread: pick.locked_spread,
      homeTeam: game.home_team,
      awayTeam: game.away_team,
      homeScore: body.homeScore,
      awayScore: body.awayScore
    });
    await supabase.from("picks").update({ result, updated_at: new Date().toISOString() }).eq("id", pick.id);
  }
  return NextResponse.json({ ok: true, graded: picks?.length || 0 });
}
