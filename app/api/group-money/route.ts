import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfileFromRequest } from "@/lib/authServer";
import { requestedGroupFromRequest, resolveGroupContext } from "@/lib/groupContext";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const schema = z.object({
  week: z.number().int().min(1).max(20),
  weeklyAmount: z.number().min(0).max(100000),
  seasonAmount: z.number().min(0).max(100000).optional()
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
    const seasonAmount = body.seasonAmount == null ? null : Math.round(body.seasonAmount * 100) / 100;
    const { data, error } = await supabase.rpc("submit_group_money", {
      p_group_id: context.group.id,
      p_season_year: context.seasonYear,
      p_week: body.week,
      p_weekly_amount: weeklyAmount,
      p_season_amount: seasonAmount,
      p_updated_by: auth.profile.id
    });
    if (error) {
      const status = /already submitted|only be submitted|submit the season pot/i.test(error.message) ? 409 : 500;
      return NextResponse.json({ ok: false, error: error.message }, { status });
    }
    const result = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({
      ok: true,
      weeklyAmount: Number(result?.weekly_amount || 0),
      seasonAmount: Number(result?.season_amount || 0),
      weeklySubmitted: Boolean(result?.weekly_submitted),
      seasonSubmitted: Boolean(result?.season_submitted)
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
