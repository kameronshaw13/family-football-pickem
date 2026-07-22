import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createProfileSession } from "@/lib/authServer";
import { findFamilyUser } from "@/lib/authUsers";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { hashPassword, makeSessionToken } from "@/lib/passwords";

const schema = z.object({
  username: z.string().min(2),
  password: z.string().min(6)
});

function publicProfile(profile: any) {
  return { id: profile.id, username: profile.username, display_name: profile.display_name, is_admin: profile.is_admin };
}

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const allowed = findFamilyUser(body.username);
    if (!allowed) return NextResponse.json({ ok: false, error: "That name is not on the pick'em list." }, { status: 403 });

    const supabase = getSupabaseAdmin();
    const { data: existing, error: existingError } = await supabase
      .from("profiles")
      .select("id,password_hash")
      .eq("username", allowed.username)
      .maybeSingle();
    if (existingError) return NextResponse.json({ ok: false, error: existingError.message }, { status: 500 });
    if (existing?.password_hash) return NextResponse.json({ ok: false, error: "That account is already created. Use sign in." }, { status: 409 });

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

    const sessionError = await createProfileSession(profile.id, token);
    if (sessionError) return NextResponse.json({ ok: false, error: `Account created, but this device session could not be saved: ${sessionError.message}` }, { status: 500 });

    return NextResponse.json({ ok: true, token, profile: publicProfile(profile) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
