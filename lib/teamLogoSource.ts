import { CBS_BY_ESPN_GUID, CBS_BY_LEAGUE } from "./cbsLogos.ts";

const CBS_LOGO_ROOT = "https://sports.cbsimg.net/fly/images/team-logos/";

const ESPN_LOGO_HOST = /^https?:\/\/(?:a|secure)\.espncdn\.com\//i;

export function isTeamLogoSource(source: string) {
  return ESPN_LOGO_HOST.test(source) && /\/teamlogos\/|\/guid\/[^/]+\/logos\//i.test(source);
}

/** Rendering lookup only: persisted logo URLs remain team identity keys. */
export function teamSvgLogo(source: string): string | null {
  if (!isTeamLogoSource(source)) return null;
  const team = source.match(/\/teamlogos\/(ncaa|nba|nfl)\/(?:[^/?#]+\/)*([^/?.#]+)\.(?:png|svg|webp)(?:[?#]|$)/i);
  const guid = source.match(/\/guid\/([^/]+)\/logos\//i)?.[1];
  const league = team?.[1].toLowerCase();
  const key = team?.[2].toLowerCase();
  const asset = league && key ? CBS_BY_LEAGUE[league]?.[key] : guid ? CBS_BY_ESPN_GUID[guid] : null;
  return typeof asset === "string" ? `${CBS_LOGO_ROOT}${asset}.svg` : null;
}
