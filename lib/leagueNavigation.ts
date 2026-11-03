import type { PickemAppSlug } from "./authUsers.ts";

export type LeagueTab = "picks" | "card" | "standings" | "settings";

export function leagueTabDestination(
  activeSlug: PickemAppSlug,
  selected: { slug: PickemAppSlug; homePath: string } | null,
  tab: LeagueTab
) {
  if (!selected || selected.slug === activeSlug || tab === "settings") return null;
  return `${selected.homePath}?view=${tab}`;
}

export function leagueTabFromQuery(value: string | null): LeagueTab | null {
  return value === "picks" || value === "card" || value === "standings" || value === "settings" ? value : null;
}

/** Session preference is only a fallback; explicit navigation always wins. */
export function leagueTabFromPreference(label: unknown): LeagueTab | null {
  return label === "Picks" ? "picks" : label === "My Card" ? "card" : label === "Standings" ? "standings" : label === "Settings" ? "settings" : null;
}
