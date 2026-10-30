const SESSION_TOKEN_KEY = "pickem_session_token";
const SESSION_PROFILE_KEY = "pickem_profile";
const SESSION_COOKIE = "pickem_session";
const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function cookieToken() {
  if (typeof document === "undefined") return "";
  const raw = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  if (!raw) return "";
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

function persistCookie(token: string) {
  if (typeof document === "undefined" || !token) return;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${SESSION_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
}

export function getClientSessionToken() {
  if (typeof window === "undefined") return "";
  try {
    const stored = window.localStorage.getItem(SESSION_TOKEN_KEY)?.trim() || "";
    if (stored) {
      persistCookie(stored);
      return stored;
    }

    const recovered = cookieToken();
    if (recovered) {
      window.localStorage.setItem(SESSION_TOKEN_KEY, recovered);
      return recovered;
    }
  } catch {
    return cookieToken();
  }
  return "";
}

export function storeClientSession(token: string, profile?: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_TOKEN_KEY, token);
    if (profile !== undefined) window.localStorage.setItem(SESSION_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // The cookie still keeps the durable session available.
  }
  persistCookie(token);
}

export function clearClientSession() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(SESSION_TOKEN_KEY);
      window.localStorage.removeItem(SESSION_PROFILE_KEY);
    } catch {
      // Continue with cookie cleanup even when storage is unavailable.
    }
  }
  if (typeof document !== "undefined") {
    document.cookie = `${SESSION_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  }
}
