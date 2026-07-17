import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfileFromRequest } from "@/lib/authServer";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { computeWeeklySettlement, computeWeeklyStandings } from "@/lib/weeklyBank";

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
    const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id,display_name").order("display_name", { ascending: true });
    if (profilesError) return NextResponse.json({ ok: false, error: profilesError.message }, { status: 500 });

    const { data: picks, error: picksError } = await supabase.from("picks").select("*").eq("week", week).eq("status", "locked");
    if (picksError) return NextResponse.json({ ok: false, error: picksError.message }, { status: 500 });

    const pendingCount = (picks || []).filter((p) => p.result === "pending").length;
    if (pendingCount > 0) return NextResponse.json({ ok: false, error: "Some picks are still pending. Settle the bank after the week is graded." }, { status: 409 });

    const standings = computeWeeklyStandings(profiles || [], picks || []);
    if (!standings.length) return NextResponse.json({ ok: false, error: "No weekly standings found." }, { status: 404 });
    const settlement = computeWeeklySettlement(standings);

    const { error: deleteError } = await supabase.from("bank_entries").delete().eq("week", week);
    if (deleteError) return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });

    const rows = (profiles || []).map((profile) => ({
      week,
      user_id: profile.id,
      amount: settlement.amounts.get(profile.id) || 0,
      note: settlement.notes.get(profile.id) || `Week ${week} settlement`
    }));

    const { error: insertError } = await supabase.from("bank_entries").insert(rows);
    if (insertError) return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });

    return NextResponse.json({ ok: true, week, perfect: settlement.perfect, entries: rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
