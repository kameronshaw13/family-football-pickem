import { logoKeyFromSource } from "@/lib/logoStudio";

export type CollegeLogoDirectoryEntry = { league: "College"; name: string; logo: string; key: string };
type ESPNTeam = { id?: string; displayName?: string; name?: string; location?: string; logos?: { href?: string }[] };
function validTeam(team: ESPNTeam): CollegeLogoDirectoryEntry | null {
  const id = String(team.id || "");
  if (!/^\d{1,8}$/.test(id)) return null;
  const name = String(team.displayName || [team.location, team.name].filter(Boolean).join(" ")).trim();
  if (!name) return null;
  const logo = `https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png`;
  const key = logoKeyFromSource(logo);
  return key ? { league: "College", name, logo, key } : null;
}
export function parseDivisionOneTeams(data: unknown): CollegeLogoDirectoryEntry[] {
  const payload = data as { sports?: { leagues?: { teams?: { team?: ESPNTeam }[] }[] }[] };
  const teams = payload?.sports?.flatMap(sport =>
    sport.leagues?.flatMap(league => league.teams || []) || []) || [];
  const found = new Map<string, CollegeLogoDirectoryEntry>();
  for (const item of teams) {
    if (!item.team) continue;
    const entry = validTeam(item.team);
    if (entry) found.set(entry.key, entry);
  }
  return [...found.values()];
}

export async function getDivisionOneLogoDirectory(): Promise<CollegeLogoDirectoryEntry[]> {
  const urls = [
    // ESPN's group 50 = NCAA Division I basketball; group 90 = FBS + FCS football.
    "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?groups=50&limit=500",
    "https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams?groups=90&limit=500"
  ];
  const fetched = await Promise.all(urls.map(async url => {
    try {
      const response = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(9000) });
      if (!response.ok) return [];
      return parseDivisionOneTeams(await response.json());
    } catch { return []; }
  }));
  // Never use ESPN's default all-division directory in a Division I-only selector.
  if (fetched[0].length < 200 && fetched[1].length < 180)
    throw new Error("Division I team directory unavailable");
  const entries = new Map<string, CollegeLogoDirectoryEntry>();
  for (const team of fetched.flat()) if (!entries.has(team.key)) entries.set(team.key, team);
  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name));
}
