import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";

// Historical archives are optional; no copyrighted images are copied into our repository.
const ARCHIVE = "https://logocdn.com";
type HistoricLogo = { label: string; url: string; year: number };
type ArchiveTeam = { name: string; logos: HistoricLogo[] };
const stripTags = (value: string) => value.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim();
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const assetRegex = /https:\/\/assets\.logocdn\.com\/images\/sports\/(nba|nfl)\/(\d{4})\/[^"'<\s]+?\.(?:png|svg|webp)/gi;

function parseArchive(html: string, league: "nba" | "nfl"): ArchiveTeam[] {
  const sections = [...html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)];
  const teams: ArchiveTeam[] = [];
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const name = stripTags(section[1]).replace(/\s+/g, " ");
    const from = (section.index || 0) + section[0].length;
    const to = i + 1 < sections.length ? sections[i + 1].index || html.length : html.length;
    const text = html.slice(from, to).replace(/&amp;/g, "&").replace(/&#64;|%40;/g, "@");
    const logos = new Map<string, HistoricLogo>();
    for (const match of text.matchAll(assetRegex)) {
      if (match[1].toLowerCase() !== league) continue;
      const year = Number(match[2]);
      if (year < 1900 || year > 2025) continue;
      const url = match[0];
      if (!logos.has(url)) logos.set(url, { label: `${year} design`, year, url });
    }
    if (name && logos.size) teams.push({ name, logos: [...logos.values()].sort((a, b) => b.year - a.year) });
  }
  return teams;
}

function findTeam(rows: ArchiveTeam[], name: string) {
  const target = normalize(name);
  return rows.find(x => normalize(x.name) === target)
    || rows.find(x => normalize(x.name).replace("losangeles", "la") === target.replace("losangeles", "la"))
    || rows.find(x => normalize(x.name).includes(target) || target.includes(normalize(x.name)));
}

export async function GET(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const league = req.nextUrl.searchParams.get("league")?.toLowerCase();
  const team = req.nextUrl.searchParams.get("team")?.slice(0, 90) || "";
  if (league !== "nba" && league !== "nfl") return NextResponse.json({ ok: false, error: "Historical archive is available for NBA and NFL." }, { status: 400 });
  try {
    const response = await fetch(`${ARCHIVE}/${league}/`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(9000) });
    if (!response.ok) throw new Error(`Archive status ${response.status}`);
    const rows = parseArchive(await response.text(), league);
    if (!rows.length) throw new Error("No historical archive entries found.");
    if (team) return NextResponse.json({ ok: true, logos: findTeam(rows, team)?.logos || [] });
    return NextResponse.json({ ok: true, teams: rows });
  } catch {
    return NextResponse.json({ ok: false, teams: [], logos: [], error: "Historical images are unavailable right now." }, { status: 503 });
  }
}
