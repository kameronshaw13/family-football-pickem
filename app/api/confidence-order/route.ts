import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfileFromRequest } from "@/lib/authServer";
import { requestedGroupFromRequest, resolveGroupContext } from "@/lib/groupContext";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const schema = z.object({ week: z.number().int().nonnegative(), gameIds: z.array(z.string().min(1)).min(1).max(5) });

export async function POST(req: NextRequest) {
  try {
    const auth = await getProfileFromRequest(req);
    if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const body = schema.parse(await req.json());
    if (new Set(body.gameIds).size !== body.gameIds.length) return NextResponse.json({ ok: false, error: "Each pick can only appear once." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const context = await resolveGroupContext(supabase, auth.profile.id, requestedGroupFromRequest(req));
    if (context.rules?.scoring?.mode !== "confidence") return NextResponse.json({ ok: false, error: "Confidence ordering is not enabled in this app." }, { status: 409 });

    const { data: picks, error } = await supabase.from("picks")
      .select("id,game_id,status,pick_type,confidence_points")
      .eq("group_id", context.group.id)
      .eq("season_year", context.seasonYear)
      .eq("user_id", auth.profile.id)
      .eq("week", body.week)
      .eq("pick_type", "regular");
    if (error) throw new Error(error.message);
    const rows = picks || [];
    const existingIds = new Set(rows.map((pick: any) => pick.game_id));
    if (body.gameIds.length !== rows.length || body.gameIds.some((id) => !existingIds.has(id))) return NextResponse.json({ ok: false, error: "Your card changed. Refresh My Card and try again." }, { status: 409 });
    const lockedMoved = rows.some((pick: any) => {
      if (pick.status !== "locked") return false;
      const points = Number(pick.confidence_points);
      const assignedIndex = 5 - points;
      return !Number.isInteger(points) || points < 1 || points > 5 || body.gameIds[assignedIndex] !== pick.game_id;
    });
    if (lockedMoved) return NextResponse.json({ ok: false, error: "Locked picks must remain in their assigned confidence slots." }, { status: 409 });

    const draftIds = new Set(rows.filter((pick: any) => pick.status === "draft").map((pick: any) => pick.game_id));
    const writes = body.gameIds.map((gameId, index) => ({ gameId, index })).filter(({ gameId }) => draftIds.has(gameId)).map(({ gameId, index }) => supabase.from("picks")
      .update({ confidence_points: Math.max(1, 5 - index), updated_at: new Date().toISOString() })
      .eq("group_id", context.group.id)
      .eq("season_year", context.seasonYear)
      .eq("user_id", auth.profile.id)
      .eq("week", body.week)
      .eq("game_id", gameId)
      .eq("pick_type", "regular")
      .eq("status", "draft"));
    const results = await Promise.all(writes);
    const failed = results.find((result) => result.error)?.error;
    if (failed) throw new Error(failed.message);

    return NextResponse.json({ ok: true, order: body.gameIds.map((gameId, index) => ({ gameId, points: Math.max(1, 5 - index) })) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
