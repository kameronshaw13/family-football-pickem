import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { validLogoUrl } from "@/lib/logoStudio";

export const dynamic = "force-dynamic";
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
type Option = { label: string; url: string; source: string };
type EspnResponse = { options: Option[]; colors: string[] };
function espnTeamColors(payload: unknown): string[] {
  const team = (payload as { team?: { color?: unknown; alternateColor?: unknown } })?.team;
  if (!team) return [];
  const colors: string[] = [];
  for (const value of [team.color, team.alternateColor]) {
    if (typeof value !== "string") continue;
    const clean = value.startsWith("#") ? value.slice(1) : value;
    if (/^[0-9a-fA-F]{6}$/.test(clean)) {
      const hex = "#" + clean.toUpperCase();
      if (!colors.includes(hex)) colors.push(hex);
    }
  }
  return colors;
}

/** Only accept an ESPN team identity from the same sport being requested. */
function espnTeamId(source: string, league: string): string | null {
  const match = source.match(/^https:\/\/(?:a|secure)\.espncdn\.com\/i\/teamlogos\/(ncaa|nba|nfl)\/(?:[^/?#]+\/)*([a-z0-9_-]+)\.(?:png|svg|webp)(?:[?#]|$)/i);
  if (!match) return null;
  const expected = league === "NBA" ? "nba" : league === "NFL" ? "nfl" : "ncaa";
  return match[1].toLowerCase() === expected ? match[2] : null;
}

function espnAlternativeLogos(payload: unknown): Option[] {
  const logos = (payload as { team?: { logos?: unknown } })?.team?.logos;
  if (!Array.isArray(logos)) return [];
  const result: Option[] = [];
  for (const logo of logos) {
    if (!logo || typeof logo !== "object") continue;
    const candidate = logo as { href?: string; rel?: string[] };
    const href = candidate.href || "";
    if (!validLogoUrl(href) || !/^https:\/\/(?:a|secure)\.espncdn\.com\//i.test(href)) continue;
    const rel = Array.isArray(candidate.rel) ? candidate.rel.join(" ").toLowerCase() : "";
    // Prioritize actual alternative artwork, not a second light/dark rendering
    // of the same primary mark.
    const secondary = /secondary|alternate|symbol|mascot|icon/.test(rel + " " + href);
    if (!secondary) continue;
    if (!result.some(option => option.url === href))
      result.push({ label: /secondary|symbol|mascot/.test(rel + " " + href) ? "ESPN secondary mark" : "ESPN alternate", url: href, source: "ESPN" });
  }
  return result.slice(0, 8);
}

async function fromESPN(league: string, source: string): Promise<EspnResponse> {
  const id = espnTeamId(source, league);
  if (!id) return { options: [], colors: [] };
  const sport = league === "NBA" ? "basketball/nba"
    : league === "NFL" ? "football/nfl" : "basketball/mens-college-basketball";
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/teams/${encodeURIComponent(id)}`, {
    next: { revalidate: 86400 }, signal: AbortSignal.timeout(6000)
  });
  if (!res.ok) return { options: [], colors: [] };
  const payload: unknown = await res.json();
  return { options: espnAlternativeLogos(payload), colors: espnTeamColors(payload) };
}

async function fromFootyLogos(name: string): Promise<Option[]> {
  const slug = slugify(name);
  if (!slug) return [];
  const res = await fetch("https://www.footylogos.com/logos/" + slug, {
    next: { revalidate: 86400 }, signal: AbortSignal.timeout(6500)
  });
  if (!res.ok) return [];
  const html = await res.text();
  const title = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]*>/g, "").trim() || "";
  const normalizedTitle = normalize(title).replace(/^la(?=[a-z])/, "losangeles");
  const normalizedName = normalize(name).replace(/^la(?=[a-z])/, "losangeles");
  if (!normalizedTitle.startsWith(normalizedName + "logo")) return [];
  const result: Option[] = [];
  const add = (label: string, url: string) => {
    if (validLogoUrl(url) && !result.some(option => option.url === url))
      result.push({ label, url, source: "FootyLogos" });
  };
  const paths = [...html.matchAll(/(?:href|src)=["'](\/sports-assets\/variants\/[a-z0-9-]+\/[a-z0-9-]+\.svg)["']/gi)];
  for (const found of paths) {
    const pathname = found[1];
    if (!pathname.startsWith("/sports-assets/variants/" + slug + "/")) continue;
    const label = /symbol|icon|mascot/.test(pathname) ? "Symbol / mascot" : "Alternate artwork";
    add(label, "https://www.footylogos.com" + pathname);
    if (result.length >= 9) break;
  }
  add("FootyLogos main crest", `https://www.footylogos.com/sports-assets/logos/${slug}/${slug}-logo-footylogos.svg`);
  return result;
}

export async function GET(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const sport = req.nextUrl.searchParams.get("league") || "";
  const name = req.nextUrl.searchParams.get("name")?.slice(0, 90) || "";
  const source = req.nextUrl.searchParams.get("logo")?.slice(0, 500) || "";
  if (!["CFB", "CBB", "NBA", "NFL"].includes(sport) || !/^[\w \-'.&()]+$/.test(name))
    return NextResponse.json({ ok: false, options: [] }, { status: 400 });

  // An unavailable provider must never suppress options found at another source.
  const [footy, espn] = await Promise.allSettled([fromFootyLogos(name), fromESPN(sport, source)]);
  const options: Option[] = [];
  const colors = espn.status === "fulfilled" ? espn.value.colors : [];
  for (const option of [
    ...(footy.status === "fulfilled" ? footy.value : []),
    ...(espn.status === "fulfilled" ? espn.value.options : [])
  ]) {
    if (!options.some(old => old.url === option.url)) options.push(option);
  }
  options.sort((a, b) => Number(/symbol|secondary|mascot|icon/i.test(b.label)) - Number(/symbol|secondary|mascot|icon/i.test(a.label)));
  return NextResponse.json({ ok: true, options: options.slice(0, 16), colors }, {
    headers: { "Cache-Control": "private, max-age=3600" }
  });
}
