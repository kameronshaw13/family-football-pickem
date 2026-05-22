import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export async function getProfileFromRequest(req: NextRequest) {
  const raw = req.headers.get("authorization") || "";
  const token = raw.replace("Bearer ", "").trim();
  if (!token) return { profile: null, error: "Missing login token.", status: 401 };

  const supabase = getSupabaseAdmin();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("session_token", token)
    .maybeSingle();

  if (error) return { profile: null, error: error.message, status: 500 };
  if (!profile) return { profile: null, error: "Session expired. Sign in again.", status: 401 };
  return { profile, error: null, status: 200 };
}
