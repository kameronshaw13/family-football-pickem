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

function clearCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}

export function getClientSessionToken() {
  if (typeof window === "undefined") return "";
  try {
    const sessionToken = window.sessionStorage.getItem(SESSION_TOKEN_KEY)?.trim() || "";
    if (sessionToken) return sessionToken;

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

export function getClientSessionProfile<T = unknown>(): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_PROFILE_KEY) || window.localStorage.getItem(SESSION_PROFILE_KEY);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

export function storeClientSession(token: string, profile?: unknown, durable = true) {
  if (typeof window === "undefined") return;
  try {
    if (durable) {
      window.localStorage.setItem(SESSION_TOKEN_KEY, token);
      window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
      if (profile !== undefined) {
        window.localStorage.setItem(SESSION_PROFILE_KEY, JSON.stringify(profile));
        window.sessionStorage.removeItem(SESSION_PROFILE_KEY);
      }
      persistCookie(token);
    } else {
      window.sessionStorage.setItem(SESSION_TOKEN_KEY, token);
      window.localStorage.removeItem(SESSION_TOKEN_KEY);
      if (profile !== undefined) {
        window.sessionStorage.setItem(SESSION_PROFILE_KEY, JSON.stringify(profile));
        window.localStorage.removeItem(SESSION_PROFILE_KEY);
      }
      clearCookie();
    }
  } catch {
    if (durable) persistCookie(token);
  }
}

export function clearClientSession() {
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
      window.sessionStorage.removeItem(SESSION_PROFILE_KEY);
      window.localStorage.removeItem(SESSION_TOKEN_KEY);
      window.localStorage.removeItem(SESSION_PROFILE_KEY);
    } catch {}
  }
  clearCookie();
}
