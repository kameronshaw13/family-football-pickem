import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUniversalProfile } from "@/lib/universalServerAuth";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const schema = z.object({ code: z.string().trim().min(4).max(32) });

export async function POST(req: NextRequest) {
  const auth = await requireUniversalProfile(req);
  if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const body = schema.parse(await req.json());
    const supabase = getSupabaseAdmin();
    const code = body.code.toUpperCase();

    const { data: invite, error: inviteError } = await supabase
      .from("group_invites")
      .select("id,group_id,is_active,max_uses,use_count,expires_at,pickem_groups(id,slug,name,short_name)")
      .ilike("code", code)
      .maybeSingle();

    if (inviteError) return NextResponse.json({ ok: false, error: inviteError.message }, { status: 500 });
    if (!invite || !invite.is_active) return NextResponse.json({ ok: false, error: "That invite code is not active." }, { status: 404 });
    if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) return NextResponse.json({ ok: false, error: "That invite link has expired." }, { status: 410 });

    const { data: existingMembership, error: membershipLookupError } = await supabase
      .from("group_members")
      .select("role,status")
      .eq("group_id", invite.group_id)
      .eq("profile_id", auth.profile.id)
      .maybeSingle();
    if (membershipLookupError) return NextResponse.json({ ok: false, error: membershipLookupError.message }, { status: 500 });
    if (existingMembership?.status === "active") {
      return NextResponse.json({ ok: true, group: invite.pickem_groups, alreadyMember: true });
    }

    if (invite.max_uses != null) {
      const { count, error: countError } = await supabase
        .from("group_members")
        .select("profile_id", { count: "exact", head: true })
        .eq("group_id", invite.group_id)
        .eq("status", "active");
      if (countError) return NextResponse.json({ ok: false, error: countError.message }, { status: 500 });
      const totalPlayerLimit = Number(invite.max_uses) + 1;
      if (Number(count || 0) >= totalPlayerLimit) {
        return NextResponse.json({ ok: false, error: "That league has reached its player limit." }, { status: 409 });
      }
    }

    const { error: memberError } = await supabase.from("group_members").upsert({
      group_id: invite.group_id,
      profile_id: auth.profile.id,
      role: existingMembership?.role || "member",
      status: "active",
      joined_at: new Date().toISOString()
    }, { onConflict: "group_id,profile_id" });
    if (memberError) return NextResponse.json({ ok: false, error: memberError.message }, { status: 500 });

    await supabase.from("group_invites").update({
      use_count: Number(invite.use_count || 0) + 1,
      updated_at: new Date().toISOString()
    }).eq("id", invite.id);

    return NextResponse.json({ ok: true, group: invite.pickem_groups });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
