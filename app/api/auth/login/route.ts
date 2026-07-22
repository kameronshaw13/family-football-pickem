import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createProfileSession } from "@/lib/authServer";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { makeSessionToken, verifyPassword } from "@/lib/passwords";

const schema = z.object({ username: z.string().min(2), password: z.string().min(6) });

function publicProfile(profile: any) {
  return { id: profile.id, username: profile.username, display_name: profile.display_name, is_admin: profile.is_admin };
}

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const username = body.username.trim().toLowerCase();
    const supabase = getSupabaseAdmin();

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!profile?.password_hash) return NextResponse.json({ ok: false, error: "Account not created yet. Choose Create account first." }, { status: 404 });
    if (!verifyPassword(body.password, profile.password_hash)) return NextResponse.json({ ok: false, error: "Incorrect password." }, { status: 401 });

    const token = makeSessionToken();
    const sessionError = await createProfileSession(profile.id, token);
    if (sessionError) return NextResponse.json({ ok: false, error: `Could not create this device session: ${sessionError.message}` }, { status: 500 });

    return NextResponse.json({ ok: true, token, profile: publicProfile(profile) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
