import { NCAA_SVG_BY_ESPN_GUID, NCAA_SVG_BY_ESPN_ID } from "./ncaaLogos.ts";

/** NCAA logo rendering lookup; original game identity keys remain unchanged. */
export function ncaaSvgLogo(source: string): string | null {
  if (!/^https?:\/\/(?:a|secure)\.espncdn\.com\//i.test(source)) return null;
  const id = source.match(/\/teamlogos\/ncaa\/(?:[^/?#]+\/)*(\d+)\.(?:png|svg|webp)(?:[?#]|$)/i)?.[1];
  const guid = source.match(/\/guid\/([^/]+)\/logos\//i)?.[1];
  const slug = id ? NCAA_SVG_BY_ESPN_ID[id] : guid ? NCAA_SVG_BY_ESPN_GUID[guid] : null;
  return slug ? `https://www.ncaa.com/sites/default/files/images/logos/schools/bgl/${slug}.svg` : null;
}
