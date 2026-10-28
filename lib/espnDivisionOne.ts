import { createAsyncCache } from "./asyncCache";

const cachedDivisionOneTeams = createAsyncCache<Set<string>>(6 * 60 * 60 * 1000, 1);

/** ESPN group 50 is NCAA men's Division I. A group-50 scoreboard can still
 * include a D-II/NAIA opponent, so check BOTH teams against the D-I directory. */
export function isDivisionOneMatchup(homeId: string | null | undefined, awayId: string | null | undefined, divisionOneIds: Set<string>) {
  return Boolean(homeId && awayId && divisionOneIds.has(homeId) && divisionOneIds.has(awayId));
}

export async function fetchEspnDivisionOneTeamIds() {
  return cachedDivisionOneTeams("cbb-d1", async () => {
    const url = "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?groups=50&limit=500";
    const response = await fetch(url, { next: { revalidate: 6 * 60 * 60 }, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`ESPN D-I team directory returned ${response.status}`);
    const payload = await response.json();
    const teams = (Array.isArray(payload?.sports) ? payload.sports : [])
      .flatMap((sport: any) => Array.isArray(sport?.leagues) ? sport.leagues : [])
      .flatMap((league: any) => Array.isArray(league?.teams) ? league.teams : []);
    const ids = new Set<string>(teams.map((row: any) => String(row?.team?.id || "")).filter(Boolean));
    if (ids.size < 250) throw new Error(`ESPN returned only ${ids.size} Division I teams`);
    return ids;
  });
}
