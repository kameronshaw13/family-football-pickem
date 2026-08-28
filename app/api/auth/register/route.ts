import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createProfileSession } from "@/lib/authServer";
import { findFamilyUser, normalizeAppSlug } from "@/lib/authUsers";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { hashPassword, makeSessionToken } from "@/lib/passwords";

export const maxDuration = 15;

const schema = z.object({ username: z.string().min(2), password: z.string().min(6), group: z.string().optional() });

function publicProfile(profile: any) {
  return { id: profile.id, username: profile.username, display_name: profile.display_name, is_admin: profile.is_admin };
}

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const groupSlug = normalizeAppSlug(body.group);
    const allowed = findFamilyUser(body.username, groupSlug);
    if (!allowed) return NextResponse.json({ ok: false, error: "That name is not on this pick'em list." }, { status: 403 });

    const supabase = getSupabaseAdmin();
    const { data: group, error: groupError } = await supabase.from("pickem_groups").select("id").eq("slug", groupSlug).maybeSingle();
    if (groupError || !group) return NextResponse.json({ ok: false, error: "This Pick'em app is not configured." }, { status: 500 });

    const { data: existingByUsername, error: existingError } = await supabase
      .from("profiles")
      .select("id,password_hash")
      .eq("username", allowed.username)
      .maybeSingle();
    if (existingError) return NextResponse.json({ ok: false, error: existingError.message }, { status: 500 });
    if (existingByUsername?.password_hash) return NextResponse.json({ ok: false, error: "That account is already created. Use sign in." }, { status: 409 });

    let existing = existingByUsername;
    if (!existing) {
      const { data: seeded, error: seededError } = await supabase
        .from("profiles")
        .select("id,password_hash")
        .ilike("display_name", allowed.displayName)
        .is("username", null)
        .maybeSingle();
      if (seededError) return NextResponse.json({ ok: false, error: seededError.message }, { status: 500 });
      existing = seeded;
    }

    const token = makeSessionToken();
    const row = {
      username: allowed.username,
      display_name: allowed.displayName,
      is_admin: allowed.isAdmin,
      password_hash: hashPassword(body.password),
      session_token: token,
      updated_at: new Date().toISOString()
    };
    const query = existing?.id
      ? supabase.from("profiles").update(row).eq("id", existing.id).select("id,username,display_name,is_admin").single()
      : supabase.from("profiles").insert(row).select("id,username,display_name,is_admin").single();
    const { data: profile, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const { data: membership, error: membershipReadError } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", group.id)
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (membershipReadError) return NextResponse.json({ ok: false, error: membershipReadError.message }, { status: 500 });
    if (!membership) {
      const { error: membershipError } = await supabase.from("group_members").insert({
        group_id: group.id,
        profile_id: profile.id,
        role: allowed.isAdmin ? "admin" : "member",
        status: "active"
      });
      if (membershipError) return NextResponse.json({ ok: false, error: membershipError.message }, { status: 500 });
    }

    const sessionError = await createProfileSession(profile.id, token);
    if (sessionError) return NextResponse.json({ ok: false, error: `Account created, but this device session could not be saved: ${sessionError.message}` }, { status: 500 });
    return NextResponse.json({ ok: true, token, profile: publicProfile(profile), group: groupSlug });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
