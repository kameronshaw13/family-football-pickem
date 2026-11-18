import { CBS_BY_ESPN_GUID, CBS_BY_LEAGUE } from "./cbsLogos.ts";
import type { League } from "./types.ts";

const CBS_LOGO_ROOT = "https://sports.cbsimg.net/fly/images/team-logos/";

/** Rendering lookup only: persisted logo URLs remain ESPN team identity keys. */
export function teamLogoCandidates(source: string, scoreboardLeague?: League): string[] {
  if (!/^https?:\/\/(?:a|secure)\.espncdn\.com\//i.test(source)) return [];
  const team = source.match(/\/teamlogos\/(ncaa|nba|nfl)\/(?:[^/?#]+\/)*([^/?.#]+)\.(?:png|svg|webp)(?:[?#]|$)/i);
  const guid = source.match(/\/guid\/([^/]+)\/logos\//i)?.[1];
  const league = team?.[1].toLowerCase();
  const key = team?.[2].toLowerCase();
  const standardAsset = league && key ? CBS_BY_LEAGUE[league]?.[key] : guid ? CBS_BY_ESPN_GUID[guid] : null;
  const collegeBasketballAsset = scoreboardLeague === "CBB" && league === "ncaa" && key
    ? CBS_BY_LEAGUE.cbb?.[key] : null;
  const asset = collegeBasketballAsset ?? standardAsset;
  if (typeof asset !== "string") return [];

  if (asset === "344") return scoreboardLeague === "NBA"
    ? ["/team-logos/nba/clippers-gametracker.svg", "/team-logos/nba/clippers.svg"]
    : ["/team-logos/nba/clippers.svg"];
  if (asset === "345") return ["/team-logos/nba/lakers.svg"];

  const standard = `${CBS_LOGO_ROOT}${asset}.svg`;
  if (!scoreboardLeague) return [standard];
  const variant = scoreboardLeague === "NBA" || scoreboardLeague === "CBB" ? "alt/light" : "light";
  return [`${CBS_LOGO_ROOT}${variant}/${asset}.svg`, standard];
}

export function teamSvgLogo(source: string): string | null {
  return teamLogoCandidates(source)[0] ?? null;
}
