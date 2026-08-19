import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfileFromRequest } from "@/lib/authServer";
import { requestedGroupFromRequest, resolveGroupContext } from "@/lib/groupContext";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const schema = z.object({
  week: z.number().int().nonnegative(),
  weeklyAmount: z.number().min(0).max(100000),
  seasonAmount: z.number().min(0).max(100000)
});

export async function POST(req: NextRequest) {
  try {
    const auth = await getProfileFromRequest(req);
    if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const body = schema.parse(await req.json());
    const supabase = getSupabaseAdmin();
    const context = await resolveGroupContext(supabase, auth.profile.id, requestedGroupFromRequest(req));
    if (context.group.slug !== "other-family") return NextResponse.json({ ok: false, error: "These money settings only apply to Other Family Pick'em." }, { status: 409 });
    if (auth.profile.display_name.trim().toLowerCase() !== "caleb") return NextResponse.json({ ok: false, error: "Only Caleb can change these winner-take-all amounts." }, { status: 403 });

    const weeklyAmount = Math.round(body.weeklyAmount * 100) / 100;
    const seasonAmount = Math.round(body.seasonAmount * 100) / 100;
    const now = new Date().toISOString();
    const [weekWrite, seasonWrite] = await Promise.all([
      supabase.from("group_week_money").upsert({
        group_id: context.group.id,
        season_year: context.seasonYear,
        week: body.week,
        winner_take_all_amount: weeklyAmount,
        updated_by: auth.profile.id,
        updated_at: now
      }, { onConflict: "group_id,season_year,week" }),
      supabase.from("group_season_money").upsert({
        group_id: context.group.id,
        season_year: context.seasonYear,
        winner_take_all_amount: seasonAmount,
        updated_by: auth.profile.id,
        updated_at: now
      }, { onConflict: "group_id,season_year" })
    ]);
    if (weekWrite.error) throw new Error(weekWrite.error.message);
    if (seasonWrite.error) throw new Error(seasonWrite.error.message);

    return NextResponse.json({ ok: true, weeklyAmount, seasonAmount });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
