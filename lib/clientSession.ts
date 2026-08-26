export type ClientSessionProfile = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  is_admin?: boolean | null;
};

const TOKEN_KEY = "pickem_session_token";
const PROFILE_KEY = "pickem_profile";

export function saveClientSession(token: string, profile?: ClientSessionProfile | null) {
  window.localStorage.setItem(TOKEN_KEY, token);
  if (profile) window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function clearClientSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(PROFILE_KEY);
}

export function localSessionToken() {
  return window.localStorage.getItem(TOKEN_KEY)?.trim() || null;
}

export async function ensurePersistentSession() {
  const localToken = localSessionToken();
  try {
    const response = await fetch("/api/auth/session", {
      headers: localToken ? { Authorization: `Bearer ${localToken}` } : undefined,
      cache: "no-store",
      credentials: "same-origin"
    });
    if (!response.ok) {
      if (response.status === 401 && localToken) clearClientSession();
      return null;
    }
    const payload = await response.json();
    if (!payload?.token) return null;
    saveClientSession(payload.token, payload.profile || null);
    return String(payload.token);
  } catch {
    return localToken;
  }
}
