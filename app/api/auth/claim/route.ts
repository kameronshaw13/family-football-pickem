import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findFamilyUser, usernameToEmail } from "@/lib/authUsers";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const schema = z.object({
  username: z.string().min(2),
  password: z.string().min(6)
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const allowed = findFamilyUser(body.username);
    if (!allowed) return NextResponse.json({ ok: false, error: "That username is not on the pick'em list." }, { status: 403 });

    const supabase = getSupabaseAdmin();
    const email = usernameToEmail(allowed.username);

    const { data: existingProfile } = await supabase.from("profiles").select("id").eq("username", allowed.username).maybeSingle();
    if (existingProfile?.id) {
      return NextResponse.json({ ok: false, error: "This account has already been claimed. Use sign in." }, { status: 409 });
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: true,
      user_metadata: { username: allowed.username, display_name: allowed.displayName }
    });

    if (error || !data.user) return NextResponse.json({ ok: false, error: error?.message || "Could not create user." }, { status: 500 });

    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user.id,
      username: allowed.username,
      display_name: allowed.displayName,
      is_admin: allowed.isAdmin
    });

    if (profileError) return NextResponse.json({ ok: false, error: profileError.message }, { status: 500 });

    return NextResponse.json({ ok: true, username: allowed.username, email });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
