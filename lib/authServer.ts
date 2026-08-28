import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const SESSION_CACHE_TTL_MS = 60_000;
const SESSION_CACHE_LIMIT = 32;
const SESSION_COOKIE = "pickem_session";
const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const sessionCache = new Map<string, { profile: any; expiresAt: number }>();

function sessionTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function cacheProfile(tokenHash: string, profile: any) {
  if (sessionCache.size >= SESSION_CACHE_LIMIT) {
    const oldestKey = sessionCache.keys().next().value;
    if (oldestKey) sessionCache.delete(oldestKey);
  }
  sessionCache.set(tokenHash, { profile, expiresAt: Date.now() + SESSION_CACHE_TTL_MS });
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export function sessionTokenFromRequest(req: NextRequest) {
  const raw = req.headers.get("authorization") || "";
  const bearer = raw.replace("Bearer ", "").trim();
  return bearer || req.cookies.get(SESSION_COOKIE)?.value?.trim() || "";
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

  const tokenHash = sessionTokenHash(clean);
  const cached = sessionCache.get(tokenHash);
  if (cached && cached.expiresAt > Date.now()) return cached.profile;
  if (cached) sessionCache.delete(tokenHash);

  const supabase = getSupabaseAdmin();
  const { data: session, error: sessionError } = await supabase
    .from("profile_sessions")
    .select("profile_id")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!sessionError && session?.profile_id) {
    const { data: sessionProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id,username,display_name,is_admin")
      .eq("id", session.profile_id)
      .maybeSingle();
    if (!profileError && sessionProfile) {
      cacheProfile(tokenHash, sessionProfile);
      return sessionProfile;
    }
  }

  // Keep the most recent pre-migration session working while the new table rolls out.
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,username,display_name,is_admin")
    .eq("session_token", clean)
    .maybeSingle();

  if (error || !profile) return null;
  cacheProfile(tokenHash, profile);
  return profile;
}

export async function getProfileFromRequest(req: NextRequest) {
  const token = sessionTokenFromRequest(req);
  if (!token) return { profile: null, error: "Missing login token.", status: 401, token: "" };

  const profile = await getProfileFromToken(token);
  if (!profile) return { profile: null, error: "Session expired. Sign in again.", status: 401, token };
  return { profile, error: null, status: 200, token };
}
