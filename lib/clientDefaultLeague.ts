"use client";

import type { PickemAppSlug } from "@/lib/authUsers";
import type { LeagueMembership } from "@/lib/leagueAccess";

const COOKIE = "pickem_default_league";
const KEY_PREFIX = "pickem_preferred_league:";

export function readPreferredLeague(profileId: string): PickemAppSlug | null {
  if (!profileId || typeof window === "undefined") return null;
  try {
    const saved = window.localStorage.getItem(KEY_PREFIX + profileId);
    if (saved === "shaw-family" || saved === "other-family" || saved === "friends" || saved === "friends-basketball") return saved;
  } catch { /* Optional storage. */ }
  return null;
}

export function savePreferredLeague(profileId: string, slug: PickemAppSlug) {
  if (typeof document === "undefined" || !profileId) return;
  try { window.localStorage.setItem(KEY_PREFIX + profileId, slug); } catch { /* Cookie still persists. */ }
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = COOKIE + "=" + encodeURIComponent(slug) + "; Max-Age=2592000; Path=/; SameSite=Lax" + secure;
}

export function preferredLeagueAmong(profileId: string, leagues: LeagueMembership[]): PickemAppSlug | null {
  const saved = readPreferredLeague(profileId);
  return saved && leagues.some(league => league.slug === saved) ? saved : null;
}
