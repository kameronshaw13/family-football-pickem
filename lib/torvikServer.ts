import { createAsyncCache } from "./asyncCache";
import { findTorvikTeam, parseTorvikFactors, parseTorvikPlayers, parseTorvikRatings, torvikTeamKey, type TorvikTeam } from "./torvikData";

type SeasonData = { teams: TorvikTeam[]; fetchedAt: string; stale: boolean; factorsAvailable: boolean; playersAvailable: boolean };
const cached = createAsyncCache<SeasonData>(60 * 60_000, 4);
const lastGood = new Map<number, SeasonData>();

async function download(path: string, optional = false) {
  const response = await fetch(`https://barttorvik.com/${path}`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(12_000), headers: { "User-Agent": "FamilyPickem/1.0 (college basketball analytics)" } });
  if (optional && response.status === 404) return null;
  if (!response.ok) throw new Error("Advanced stats are temporarily unavailable.");
  const text = await response.text();
  if (/^\s*</.test(text)) throw new Error("The stats source did not return a data file.");
  return text;
}

export function loadTorvikSeason(year: number): Promise<SeasonData> {
  if (!Number.isInteger(year) || year < 2008 || year > 2100) throw new Error("Invalid basketball season.");
  return cached(String(year), async () => {
    try {
      const text = await download(`${year}_team_results.csv`);
      const teams = parseTorvikRatings(text!);
      if (teams.length < 100) throw new Error("Incomplete ratings download.");
      const inSeason = teams.some(team => team.games > 0);
      const optional = await Promise.allSettled([
        download(`${year}_fffinal.csv`, true).then(text => text ? parseTorvikFactors(text) : []),
        inSeason ? download(`getadvstats.php?year=${year}&csv=1`, true).then(text => text ? parseTorvikPlayers(text, year) : []) : Promise.resolve([])
      ]);
      const factors = optional[0].status === "fulfilled" ? optional[0].value : [];
      const players = optional[1].status === "fulfilled" ? optional[1].value : [];
      const factorsByTeam = new Map(factors.map(row => [torvikTeamKey(row.name), row]));
      for (const team of teams) {
        // Preseason player inputs can contain last year's games with this year's
        // roster. Never label those as games played in the new season.
        if (!team.games) continue;
        Object.assign(team.metrics, factorsByTeam.get(torvikTeamKey(team.name))?.metrics || {});
      }
      for (const player of players) {
        const team = findTorvikTeam(teams, player.team);
        if (team && team.games > 0 && player.games <= team.games) {
          team.players.push({ id: player.id, name: player.name, games: player.games, year: player.year, metrics: player.metrics });
        }
      }
      const data = { teams, fetchedAt: new Date().toISOString(), stale: false, factorsAvailable: factors.length > 0, playersAvailable: teams.some(team => team.players.length > 0) };
      if (lastGood.size >= 4) lastGood.delete(lastGood.keys().next().value!);
      lastGood.set(year, data);
      return data;
    } catch (error) {
      const prior = lastGood.get(year);
      if (prior && Date.now() - Date.parse(prior.fetchedAt) < 48 * 60 * 60_000) return { ...prior, stale: true };
      throw error;
    }
  });
}
