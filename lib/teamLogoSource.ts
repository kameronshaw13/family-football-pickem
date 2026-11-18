import { NCAA_SVG_BY_ESPN_GUID, NCAA_SVG_BY_ESPN_ID } from "./ncaaLogos.ts";
import { NBA_SVG_BY_ESPN_KEY, NFL_SVG_BY_ESPN_KEY } from "./proLogos.ts";

/** NCAA logo rendering lookup; original game identity keys remain unchanged. */
export function ncaaSvgLogo(source: string): string | null {
  if (!/^https?:\/\/(?:a|secure)\.espncdn\.com\//i.test(source)) return null;
  const id = source.match(/\/teamlogos\/ncaa\/(?:[^/?#]+\/)*(\d+)\.(?:png|svg|webp)(?:[?#]|$)/i)?.[1];
  const guid = source.match(/\/guid\/([^/]+)\/logos\//i)?.[1];
  const slug = id ? NCAA_SVG_BY_ESPN_ID[id] : guid ? NCAA_SVG_BY_ESPN_GUID[guid] : null;
  return slug ? `https://www.ncaa.com/sites/default/files/images/logos/schools/bgl/${slug}.svg` : null;
}

/** Recognize saved ESPN logo URLs without changing the artwork provider. */
export function isTeamLogoSource(source: string) {
  return /^https?:\/\/(?:a|secure)\.espncdn\.com\//i.test(source) && /\/teamlogos\/|\/guid\/[^/]+\/logos\//i.test(source);
}

/** One consistent vector provider per league, with no CBS overrides. */
export function teamVectorLogo(source: string): string | null {
  if (!isTeamLogoSource(source)) return null;
  const team = source.match(/\/teamlogos\/(nba|nfl)\/(?:[^/?#]+\/)*([^/?.#]+)\.(?:png|svg|webp)(?:[?#]|$)/i);
  if (team) {
    const provider = team[1].toLowerCase() === "nba" ? NBA_SVG_BY_ESPN_KEY : NFL_SVG_BY_ESPN_KEY;
    return provider[team[2].toLowerCase()] ?? null;
  }
  return ncaaSvgLogo(source);
}
