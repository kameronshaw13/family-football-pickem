import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

function bearerToken(req: NextRequest) {
  return (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

function fallbackDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> }) {
  const metaName = String(user.user_metadata?.full_name || user.user_metadata?.name || "").trim();
  if (metaName) return metaName;
  return String(user.email || "Player").split("@")[0] || "Player";
}

export async function requireUniversalProfile(req: NextRequest) {
  const token = bearerToken(req);
  if (!token) return { profile: null, user: null, error: "Missing account session.", status: 401 as const };

  const supabase = getSupabaseAdmin();
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user) return { profile: null, user: null, error: "Account session is invalid or expired.", status: 401 as const };

  const email = user.email?.toLowerCase() || null;
  const { data: linked } = await supabase
    .from("profiles")
    .select("id,display_name,username,email,auth_user_id,is_admin")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (linked) {
    if (email && linked.email !== email) {
      await supabase.from("profiles").update({ email, updated_at: new Date().toISOString() }).eq("id", linked.id);
      linked.email = email;
    }
    return { profile: linked, user, error: null, status: 200 as const };
  }

  let existing: any = null;
  if (email) {
    const response = await supabase
      .from("profiles")
      .select("id,display_name,username,email,auth_user_id,is_admin")
      .eq("email", email)
      .maybeSingle();
    existing = response.data;
  }

  if (existing) {
    const { data, error } = await supabase
      .from("profiles")
      .update({ auth_user_id: user.id, email, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select("id,display_name,username,email,auth_user_id,is_admin")
      .single();
    if (error) return { profile: null, user, error: error.message, status: 500 as const };
    return { profile: data, user, error: null, status: 200 as const };
  }

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      display_name: fallbackDisplayName(user),
      email,
      auth_user_id: user.id,
      is_admin: false
    })
    .select("id,display_name,username,email,auth_user_id,is_admin")
    .single();

  if (error) return { profile: null, user, error: error.message, status: 500 as const };
  return { profile: data, user, error: null, status: 200 as const };
}
