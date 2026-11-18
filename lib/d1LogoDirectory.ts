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
  // The men's college basketball teams endpoint returns the current Division I
  // membership (365 in November 2026). The football /teams endpoint ignores
  // group=90 and includes Division II/III schools; never union it into this list.
  const url = "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?groups=50&limit=500";
  const response = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(9000) });
  if (!response.ok) throw new Error("Division I team directory unavailable");
  const teams = parseDivisionOneTeams(await response.json());
  if (teams.length < 300 || teams.length > 425) throw new Error("Division I team list failed validation");
  return teams.sort((a, b) => a.name.localeCompare(b.name));
}
