import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

function sessionTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createProfileSession(profileId: string, token: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("profile_sessions").insert({
    profile_id: profileId,
    token_hash: sessionTokenHash(token)
  });
  return error;
}

export async function getProfileFromToken(token: string) {
  const clean = token.trim();
  if (!clean) return null;

  const supabase = getSupabaseAdmin();
  const { data: session, error: sessionError } = await supabase
    .from("profile_sessions")
    .select("profile_id")
    .eq("token_hash", sessionTokenHash(clean))
    .maybeSingle();

  if (!sessionError && session?.profile_id) {
    const { data: sessionProfile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.profile_id)
      .maybeSingle();
    if (!profileError && sessionProfile) return sessionProfile;
  }

  // Keep the most recent pre-migration session working while the new table rolls out.
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("session_token", clean)
    .maybeSingle();

  if (error || !profile) return null;
  return profile;
}

export async function getProfileFromRequest(req: NextRequest) {
  const raw = req.headers.get("authorization") || "";
  const token = raw.replace("Bearer ", "").trim();
  if (!token) return { profile: null, error: "Missing login token.", status: 401 };

  const profile = await getProfileFromToken(token);
  if (!profile) return { profile: null, error: "Session expired. Sign in again.", status: 401 };
  return { profile, error: null, status: 200 };
}
