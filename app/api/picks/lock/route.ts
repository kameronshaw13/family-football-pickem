import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfileFromRequest } from "@/lib/authServer";
import { getGroupGameLockTime, getGroupUnderdogBonus, requestedGroupFromRequest, resolveGroupContext } from "@/lib/groupContext";
import { getPickWeekOpenTime } from "@/lib/lockRules";
import { normalizeSpreadForSelectedTeam } from "@/lib/spreads";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const bodySchema = z.object({
  week: z.number().int().nonnegative(),
  selectedTeam: z.string().min(1)
});

export async function POST(req: NextRequest) {
  try {
    const auth = await getProfileFromRequest(req);
    if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const body = bodySchema.parse(await req.json());
    const supabase = getSupabaseAdmin();
    const context = await resolveGroupContext(supabase, auth.profile.id, requestedGroupFromRequest(req));
    const now = new Date();
    const nowIso = now.toISOString();

    const { data: candidates, error } = await supabase
      .from("picks")
      .select("*, game:games(*)")
      .eq("group_id", context.group.id)
      .eq("season_year", context.seasonYear)
      .eq("user_id", auth.profile.id)
      .eq("week", body.week)
      .eq("selected_team", body.selectedTeam)
      .eq("status", "draft");
    if (error) throw new Error(error.message);

    const pick = (candidates || [])[0];
    if (!pick?.game) return NextResponse.json({ ok: false, error: "Wait for this pick to finish saving, then lock it." }, { status: 409 });

    const weekOpen = getPickWeekOpenTime(body.week, [pick.game.commence_time], context.group.timezone);
    if (weekOpen && now < weekOpen) return NextResponse.json({ ok: false, error: "This week is not open yet." }, { status: 409 });

    const automaticLock = getGroupGameLockTime(context, pick.game.commence_time);
    if (now >= automaticLock) return NextResponse.json({ ok: false, error: "This pick has already reached its automatic lock time." }, { status: 409 });

    const lockedSpread = normalizeSpreadForSelectedTeam(pick.selected_team, pick.game.current_spread_team, pick.game.current_spread);
    if (lockedSpread == null) return NextResponse.json({ ok: false, error: "This pick cannot be locked until a spread is available." }, { status: 409 });
    const dogValue = pick.pick_type === "underdog" ? getGroupUnderdogBonus(context, lockedSpread) : null;

    const { data: locked, error: lockError } = await supabase
      .from("picks")
      .update({
        status: "locked",
        locked_at: nowIso,
        locked_spread: lockedSpread,
        locked_spread_team: pick.selected_team,
        underdog_win_value: dogValue,
        updated_at: nowIso
      })
      .eq("id", pick.id)
      .eq("group_id", context.group.id)
      .eq("status", "draft")
      .select("id,selected_team,pick_type,locked_spread,locked_at,status")
      .maybeSingle();
    if (lockError) throw new Error(lockError.message);
    if (!locked) return NextResponse.json({ ok: false, error: "This pick was already locked or changed." }, { status: 409 });

    return NextResponse.json({ ok: true, pick: locked });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
