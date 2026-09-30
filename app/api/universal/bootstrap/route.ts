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

  const rows = (memberships || []).filter((row: any) => row.pickem_groups?.id);
  const groupIds = rows.map((row: any) => row.pickem_groups.id);
  const memberCounts = new Map<string, number>();
  const activeInvites = new Map<string, { code: string; max_uses: number | null }>();

  if (groupIds.length) {
    const [{ data: activeMembers, error: membersError }, { data: invites, error: invitesError }] = await Promise.all([
      supabase.from("group_members").select("group_id").in("group_id", groupIds).eq("status", "active"),
      supabase.from("group_invites").select("group_id,code,max_uses,is_active").in("group_id", groupIds).eq("is_active", true)
    ]);
    if (membersError) return NextResponse.json({ ok: false, error: membersError.message }, { status: 500 });
    if (invitesError) return NextResponse.json({ ok: false, error: invitesError.message }, { status: 500 });

    for (const member of activeMembers || []) {
      memberCounts.set(member.group_id, (memberCounts.get(member.group_id) || 0) + 1);
    }
    for (const invite of invites || []) {
      if (!activeInvites.has(invite.group_id)) {
        activeInvites.set(invite.group_id, { code: invite.code, max_uses: invite.max_uses == null ? null : Number(invite.max_uses) });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    profile: auth.profile,
    memberships: rows.map((row: any) => {
      const invite = activeInvites.get(row.pickem_groups.id);
      const commissioner = row.role === "admin" || row.role === "owner";
      return {
        role: row.role,
        memberCount: memberCounts.get(row.pickem_groups.id) || 0,
        playerLimit: invite?.max_uses == null ? null : invite.max_uses + 1,
        inviteCode: commissioner ? invite?.code || null : null,
        group: row.pickem_groups
      };
    })
  });
}
