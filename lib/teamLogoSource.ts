import { NCAA_SVG_BY_ESPN_GUID, NCAA_SVG_BY_ESPN_ID } from "./ncaaLogos.ts";
import { CBS_BY_ESPN_GUID, CBS_BY_LEAGUE } from "./cbsLogos.ts";

const CBS_ROOT = "https://sports.cbsimg.net/fly/images/team-logos/";

/** NCAA fallback for school artwork CBS does not list. */
export function ncaaSvgLogo(source: string): string | null {
  if (!/^https?:\/\/(?:a|secure)\.espncdn\.com\//i.test(source)) return null;
  const id = source.match(/\/teamlogos\/ncaa\/(?:[^/?#]+\/)*(\d+)\.(?:png|svg|webp)(?:[?#]|$)/i)?.[1];
  const guid = source.match(/\/guid\/([^/]+)\/logos\//i)?.[1];
  const slug = id ? NCAA_SVG_BY_ESPN_ID[id] : guid ? NCAA_SVG_BY_ESPN_GUID[guid] : null;
  return slug ? "https://www.ncaa.com/sites/default/files/images/logos/schools/bgl/" + slug + ".svg" : null;
}

/** Original ESPN URLs are only identity keys; they are never rewritten in storage. */
export function isTeamLogoSource(source: string) {
  return /^https?:\/\/(?:a|secure)\.espncdn\.com\//i.test(source) &&
    /\/teamlogos\/|\/guid\/[^/]+\/logos\//i.test(source);
}

function cbsTeamAsset(source: string): string | null {
  if (!isTeamLogoSource(source)) return null;
  const team = source.match(/\/teamlogos\/(ncaa|nba|nfl)\/(?:[^/?#]+\/)*([^/?.#]+)\.(?:png|svg|webp)(?:[?#]|$)/i);
  const byTeam = team ? CBS_BY_LEAGUE[team[1].toLowerCase()]?.[team[2].toLowerCase()] : null;
  const guid = source.match(/\/guid\/([^/]+)\/logos\//i)?.[1];
  return byTeam ?? (guid ? CBS_BY_ESPN_GUID[guid] : null) ?? null;
}

/**
 * CBS's current GameTracker serves its color artwork in the /alt/ variant,
 * distinct from /light/ background watermarks and generic directory logos.
 * Use this same source for NBA, NFL and college teams.
 */
export function teamVectorLogo(source: string): string | null {
  const asset = cbsTeamAsset(source);
  return asset ? CBS_ROOT + "alt/" + asset + ".svg" : ncaaSvgLogo(source);
}

/** Retry the same CBS asset family if a GameTracker variant is unavailable. */
export function teamVectorFallbackLogo(source: string): string | null {
  const asset = cbsTeamAsset(source);
  return asset ? CBS_ROOT + asset + ".svg" : null;
}
