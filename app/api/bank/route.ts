import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const saveSettingsSchema = z.object({ action: z.literal("saveSettings"), winnerAmount: z.number(), loserAmount: z.number() });
const settleWeekSchema = z.object({ action: z.literal("settleWeek"), week: z.number() });
const bodySchema = z.discriminatedUnion("action", [saveSettingsSchema, settleWeekSchema]);

async function getAdminProfile(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return { profile: null, error: "Missing auth token.", status: 401 };
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { profile: null, error: error?.message || "Invalid auth token.", status: 401 };
  const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
  if (profileError || !profile) return { profile: null, error: "Profile not found.", status: 404 };
  if (!profile.is_admin) return { profile: null, error: "Admin only.", status: 403 };
  return { profile, error: null, status: 200 };
}

type WeekLine = { user_id: string; display_name: string; wins: number; losses: number; pushes: number; win_pct: number };

function computeWeeklyStandings(profiles: any[], picks: any[]): WeekLine[] {
  const map = new Map<string, WeekLine>();
  for (const profile of profiles) {
    map.set(profile.id, { user_id: profile.id, display_name: profile.display_name, wins: 0, losses: 0, pushes: 0, win_pct: 0 });
  }
  for (const pick of picks) {
    const row = map.get(pick.user_id);
    if (!row || pick.status !== "locked") continue;
    if (pick.result === "win") row.wins += pick.pick_type === "underdog" ? Number(pick.underdog_win_value || 1) : 1;
    if (pick.result === "loss") row.losses += 1;
    if (pick.result === "push") row.pushes += 1;
  }
  const out = Array.from(map.values());
  for (const row of out) {
    row.win_pct = row.wins + row.losses === 0 ? 0 : row.wins / (row.wins + row.losses);
  }
  out.sort((a, b) => (b.win_pct - a.win_pct) || (b.wins - a.wins) || (a.losses - b.losses) || a.display_name.localeCompare(b.display_name));
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const adminResult = await getAdminProfile(req);
    if (!adminResult.profile) return NextResponse.json({ ok: false, error: adminResult.error }, { status: adminResult.status });
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
    const { data: settings, error: settingsError } = await supabase.from("bank_settings").select("*").eq("id", 1).maybeSingle();
    if (settingsError) return NextResponse.json({ ok: false, error: settingsError.message }, { status: 500 });

    const { data: profiles, error: profilesError } = await supabase.from("profiles").select("*").order("display_name", { ascending: true });
    if (profilesError) return NextResponse.json({ ok: false, error: profilesError.message }, { status: 500 });

    const { data: picks, error: picksError } = await supabase.from("picks").select("*").eq("week", week).eq("status", "locked");
    if (picksError) return NextResponse.json({ ok: false, error: picksError.message }, { status: 500 });

    const pendingCount = (picks || []).filter((p) => p.result === "pending").length;
    if (pendingCount > 0) return NextResponse.json({ ok: false, error: "Some picks are still pending. Settle the bank after the week is graded." }, { status: 409 });

    const standings = computeWeeklyStandings(profiles || [], picks || []);
    if (!standings.length) return NextResponse.json({ ok: false, error: "No weekly standings found." }, { status: 404 });

    const top = standings[0];
    const winners = standings.filter((row) => row.win_pct === top.win_pct && row.wins === top.wins && row.losses === top.losses);
    if (winners.length !== 1) {
      return NextResponse.json({ ok: false, error: "This week has a tie for first. Leave the bank unsettled or adjust it manually later." }, { status: 409 });
    }

    const winner = winners[0];
    const winnerAmount = Number(settings?.winner_amount ?? 20);
    const loserAmount = Number(settings?.loser_amount ?? 10);

    const { error: deleteError } = await supabase.from("bank_entries").delete().eq("week", week);
    if (deleteError) return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });

    const rows = (profiles || []).map((profile) => ({
      week,
      user_id: profile.id,
      amount: profile.id === winner.user_id ? winnerAmount : -loserAmount,
      note: profile.id === winner.user_id ? `Week ${week} winner` : `Week ${week} loss`
    }));

    const { error: insertError } = await supabase.from("bank_entries").insert(rows);
    if (insertError) return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });

    return NextResponse.json({ ok: true, week, winner: winner.display_name, winnerAmount, loserAmount });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
