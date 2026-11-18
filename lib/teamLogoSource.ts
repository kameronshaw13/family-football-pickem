import { CBS_BY_ESPN_GUID, CBS_BY_LEAGUE } from "./cbsLogos.ts";

/** Rendering lookup only: persisted logo URLs remain ESPN team identity keys. */
export function teamSvgLogo(source: string, basketballScoreboard = false): string | null {
  if (!/^https?:\/\/(?:a|secure)\.espncdn\.com\//i.test(source)) return null;
  const team = source.match(/\/teamlogos\/(ncaa|nba|nfl)\/(?:[^/?#]+\/)*([^/?.#]+)\.(?:png|svg|webp)(?:[?#]|$)/i);
  const guid = source.match(/\/guid\/([^/]+)\/logos\//i)?.[1];
  const asset = team
    ? CBS_BY_LEAGUE[team[1].toLowerCase()]?.[team[2].toLowerCase()]
    : guid ? CBS_BY_ESPN_GUID[guid] : null;
  // CBS uses a white Clippers mark in its GameTracker header. The navy
  // version stays visible on white backgrounds elsewhere in the app.
  if (asset === "344") return basketballScoreboard
    ? "/team-logos/nba/clippers-gametracker.svg"
    : "/team-logos/nba/clippers.svg";
  if (asset === "345") return "/team-logos/nba/lakers.svg";
  return typeof asset === "string" ? `https://sports.cbsimg.net/fly/images/team-logos/${asset}.svg` : null;
}
