"use client";

/** Shared browser-only helpers for app-wide overlays and enhancements.
 * Keep league routing and week-selector discovery in one place instead of
 * allowing each overlay to interpret navigation differently.
 */
export type ClientLeagueSlug = "shaw-family" | "other-family" | "friends" | "friends-basketball";

export function appSlugFromPath(): ClientLeagueSlug {
  if (window.location.pathname.startsWith("/friends-basketball")) return "friends-basketball";
  if (window.location.pathname.startsWith("/friends")) return "friends";
  if (window.location.pathname.startsWith("/caleb-family")) return "other-family";
  return "shaw-family";
}

export function selectedWeekFromHeader(): number | null {
  const text = document.querySelector<HTMLElement>(".week-select-wrap .custom-select-trigger")?.textContent || "";
  const match = text.match(/Week\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

/**
 * Read an enhancement's current app-data snapshot without duplicating the
 * storage-key scan. Rendering enhancements must not mutate the stored payload.
 * Batch submissions require the selected week to match; read-only display
 * overlays preserve their prior permissive fallback behavior.
 */
export function readCachedAppPayload<T>(
  slug: ClientLeagueSlug,
  requireWeekMatch: boolean,
  cachePrefix = "pickem_app_data_v2"
): T | null {
  const week = selectedWeekFromHeader();
  const preferredKeys = [
    `${cachePrefix}:${slug}:${week == null ? "default" : week}`,
    `${cachePrefix}:${slug}:default`
  ];
  const additionalKeys: string[] = [];
  try {
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(`${cachePrefix}:${slug}:`) && !preferredKeys.includes(key)) additionalKeys.push(key);
    }
    for (const key of [...preferredKeys, ...additionalKeys]) {
      try {
        const raw = window.sessionStorage.getItem(key);
        if (!raw) continue;
        const entry = JSON.parse(raw) as { payload?: T } | null;
        const payload = entry?.payload;
        if (!payload) continue;
        const payloadWeek = (payload as { week?: number | null }).week;
        if (requireWeekMatch && week != null && payloadWeek != null && Number(payloadWeek) !== week) continue;
        return payload;
      } catch {
        // Skip one malformed or stale snapshot without hiding other candidates.
      }
    }
  } catch {
    // Storage can be disabled; the feature falls back to its empty state.
  }
  return null;
}
