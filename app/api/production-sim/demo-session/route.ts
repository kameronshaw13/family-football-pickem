import { NextResponse } from "next/server";
import { createProfileSession, setSessionCookie } from "@/lib/authServer";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { makeSessionToken } from "@/lib/passwords";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  try {
    const supabase = getSupabaseAdmin();
    const { data: profile, error } = await supabase.from("profiles").select("id,username,display_name,is_admin").eq("username", "demo-preview").maybeSingle();
    if (error || !profile) return NextResponse.json({ ok: false, error: "Demo profile is not configured." }, { status: 500 });

    const { data: group, error: groupError } = await supabase.from("pickem_groups").select("id").eq("slug", "development").maybeSingle();
    if (groupError || !group) return NextResponse.json({ ok: false, error: "Demo league is not configured." }, { status: 500 });

    const { data: membership, error: membershipError } = await supabase.from("group_members").select("status").eq("group_id", group.id).eq("profile_id", profile.id).eq("status", "active").maybeSingle();
    if (membershipError || !membership) return NextResponse.json({ ok: false, error: "Demo membership is not configured." }, { status: 500 });

    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("profile_sessions").delete().eq("profile_id", profile.id).lt("created_at", cutoff);

    const token = makeSessionToken();
    const sessionError = await createProfileSession(profile.id, token);
    if (sessionError) return NextResponse.json({ ok: false, error: sessionError.message }, { status: 500 });

    const response = NextResponse.json({ ok: true, token, profile }, { headers: { "Cache-Control": "no-store" } });
    setSessionCookie(response, token);
    return response;
  } catch (cause) {
    return NextResponse.json({ ok: false, error: cause instanceof Error ? cause.message : String(cause) }, { status: 500 });
  }
}
