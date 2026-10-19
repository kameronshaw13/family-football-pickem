import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { requestedGroupFromRequest, resolveGroupContext } from "@/lib/groupContext";
import { refreshBasketballSlate } from "@/lib/basketballSync";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const maxDuration = 60;
export async function POST(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  try {
    const supabase = getSupabaseAdmin();
    const context = await resolveGroupContext(supabase, auth.profile.id, requestedGroupFromRequest(req));
    if (context.group.slug !== "friends-basketball" || !["owner", "admin"].includes(context.group.role)) return NextResponse.json({ ok: false, error: "Basketball league administrator required." }, { status: 403 });
    return NextResponse.json({ ok: true, ...await refreshBasketballSlate(supabase) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not refresh basketball." }, { status: 500 });
  }
}
