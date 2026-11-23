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
