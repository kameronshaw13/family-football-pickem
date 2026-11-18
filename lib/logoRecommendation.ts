import { NBA_SVG_BY_ESPN_KEY } from "./proLogos.ts";
import { ncaaSvgLogo } from "./teamLogoSource.ts";

export type StudioLogoTeam = { league: string; logo: string; key: string; name: string };
export type StudioRecommendedLogo = { url: string; source: string };
export type StudioLogoChoice = { modern?: string | null; vintage?: string | null };

/**
 * Prefer logo assets owned by the sports organization where we have them.
 * NFL and unmapped NCAA teams keep ESPN as a reference, not a claim of
 * verified trademark color equivalence. Historical assets are never used.
 */
export function recommendedModernLogo(team: StudioLogoTeam): StudioRecommendedLogo | null {
  const raw = team.logo;
  if (!/^https:\/\/(?:a|secure)\.espncdn\.com\//i.test(raw)) return null;
  const match = raw.match(/\/teamlogos\/(nba|nfl|ncaa)\/(?:[^/?#]+\/)*([a-z0-9_-]+)\.(?:png|svg|webp)(?:[?#]|$)/i);
  const kind = match?.[1]?.toLowerCase();
  const id = match?.[2]?.toLowerCase();
  if (team.league === "NBA" && kind === "nba" && id && NBA_SVG_BY_ESPN_KEY[id])
    return { url: NBA_SVG_BY_ESPN_KEY[id], source: "NBA.com league artwork" };
  if (team.league === "College" && kind === "ncaa") {
    const fromNCAA = ncaaSvgLogo(raw);
    if (fromNCAA) return { url: fromNCAA, source: "NCAA.com school artwork" };
  }
  if (team.league === "NFL" && kind === "nfl" || team.league === "NBA" && kind === "nba" || team.league === "College" && kind === "ncaa")
    return { url: raw, source: "ESPN reference artwork" };
  return null;
}

/** Batch-fill only untouched Modern entries. Never replace a user's picks. */
export function draftRecommendedModernLogos(
  teams: StudioLogoTeam[],
  original: Record<string, StudioLogoChoice>,
  published: Record<string, string>
): { choices: Record<string, StudioLogoChoice>; added: number; bySource: Record<string, number> } {
  const choices = { ...original };
  const bySource: Record<string, number> = {};
  let added = 0;
  for (const team of teams) {
    if (!team.key || Object.prototype.hasOwnProperty.call(choices[team.key] || {}, "modern") || Object.prototype.hasOwnProperty.call(published, team.key))
      continue;
    const pick = recommendedModernLogo(team);
    if (!pick) continue;
    choices[team.key] = { ...(choices[team.key] || {}), modern: pick.url };
    added += 1;
    bySource[pick.source] = (bySource[pick.source] || 0) + 1;
  }
  return { choices, added, bySource };
}
