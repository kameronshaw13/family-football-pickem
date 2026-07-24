import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { finalizeGame } from "@/lib/finalizeGame";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const schema = z.object({ gameId: z.string(), homeScore: z.number(), awayScore: z.number(), secret: z.string().optional() });

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    if (!process.env.CRON_SECRET || body.secret !== process.env.CRON_SECRET) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabaseAdmin();
    const { data: game, error: gameErr } = await supabase.from("games").select("*").eq("id", body.gameId).single();
    if (gameErr) return NextResponse.json({ ok: false, error: gameErr.message }, { status: 404 });

    const finalized = await finalizeGame(supabase, game, body.homeScore, body.awayScore);
    return NextResponse.json({
      ok: true,
      graded: finalized.picksGraded,
      sideBetsGraded: finalized.sideBetsGraded,
      weekSettled: finalized.settlement.settled
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
