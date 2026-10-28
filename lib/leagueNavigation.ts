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
