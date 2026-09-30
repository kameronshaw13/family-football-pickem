import { NextRequest, NextResponse } from "next/server";
import { requireUniversalProfile } from "@/lib/universalServerAuth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireUniversalProfile(req);
  if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const supabase = getSupabaseAdmin();
  const { data: memberships, error } = await supabase
    .from("group_members")
    .select("role,status,pickem_groups(id,slug,name,short_name,current_season_year)")
    .eq("profile_id", auth.profile.id)
    .eq("status", "active")
    .order("joined_at", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    profile: auth.profile,
    memberships: (memberships || []).map((row: any) => ({
      role: row.role,
      group: row.pickem_groups
    }))
  });
}
