import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { settleWeekIfReady } from "@/lib/autoSettlement";
import { getProfileFromRequest } from "@/lib/authServer";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const saveSettingsSchema = z.object({ action: z.literal("saveSettings"), winnerAmount: z.number(), loserAmount: z.number() });
const settleWeekSchema = z.object({ action: z.literal("settleWeek"), week: z.number() });
const bodySchema = z.discriminatedUnion("action", [saveSettingsSchema, settleWeekSchema]);

export async function POST(req: NextRequest) {
  try {
    const auth = await getProfileFromRequest(req);
    if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    if (!auth.profile.is_admin) return NextResponse.json({ ok: false, error: "Admin only." }, { status: 403 });

    const body = bodySchema.parse(await req.json());
    const supabase = getSupabaseAdmin();

    if (body.action === "saveSettings") {
      const winnerAmount = Math.max(0, Number(body.winnerAmount));
      const loserAmount = Math.max(0, Number(body.loserAmount));
      const { error } = await supabase.from("bank_settings").upsert({ id: 1, winner_amount: winnerAmount, loser_amount: loserAmount, updated_at: new Date().toISOString() });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, bankSettings: { id: 1, winner_amount: winnerAmount, loser_amount: loserAmount } });
    }

    const week = Number(body.week);
    const settlement = await settleWeekIfReady(supabase, week);
    if (!settlement.settled) {
      return NextResponse.json({ ok: false, error: settlement.reason || "The week is not ready to settle." }, { status: 409 });
    }
    return NextResponse.json({ ok: true, week, perfect: settlement.perfect, entries: settlement.entries });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
