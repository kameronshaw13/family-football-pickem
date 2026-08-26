import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createProfileSession, setSessionCookie } from "@/lib/authServer";
import { findFamilyUser, normalizeAppSlug } from "@/lib/authUsers";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { makeSessionToken, verifyPassword } from "@/lib/passwords";

const schema = z.object({ username: z.string().min(2), password: z.string().optional(), group: z.string().optional() });

function publicProfile(profile: any) {
  return { id: profile.id, username: profile.username, display_name: profile.display_name, is_admin: profile.is_admin };
}

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const groupSlug = normalizeAppSlug(body.group);
    const allowed = findFamilyUser(body.username, groupSlug);
    if (!allowed) return NextResponse.json({ ok: false, error: "That name is not on this pick'em list." }, { status: 403 });

    const username = allowed.username;
    const supabase = getSupabaseAdmin();

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    if (!profile) {
      return NextResponse.json({ ok: false, error: "Account not created yet. Choose Create account first." }, { status: 404 });
    }

    if (!profile.password_hash) return NextResponse.json({ ok: false, error: "Account not created yet. Choose Create account first." }, { status: 404 });
    if (!body.password || body.password.length < 6 || !verifyPassword(body.password, profile.password_hash)) {
      return NextResponse.json({ ok: false, error: "Incorrect password." }, { status: 401 });
    }

    const { data: group, error: groupError } = await supabase.from("pickem_groups").select("id").eq("slug", groupSlug).maybeSingle();
    if (groupError || !group) return NextResponse.json({ ok: false, error: "This Pick'em app is not configured." }, { status: 500 });
    const { data: membership, error: membershipError } = await supabase
      .from("group_members")
      .select("status")
      .eq("group_id", group.id)
      .eq("profile_id", profile.id)
      .eq("status", "active")
      .maybeSingle();
    if (membershipError) return NextResponse.json({ ok: false, error: membershipError.message }, { status: 500 });
    if (!membership) return NextResponse.json({ ok: false, error: "Your account is not in this Pick'em app." }, { status: 403 });

    const token = makeSessionToken();
    const sessionError = await createProfileSession(profile.id, token);
    if (sessionError) return NextResponse.json({ ok: false, error: `Could not create this device session: ${sessionError.message}` }, { status: 500 });

    const response = NextResponse.json({ ok: true, token, profile: publicProfile(profile), group: groupSlug });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
