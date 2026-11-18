/** Parse year-labelled historical logos without leaking the next team's crest into a row. */
export type ArchivedLogo = { label: string; url: string; year: number };
export type ArchivedTeam = { name: string; logos: ArchivedLogo[] };

const ASSET = /https:\/\/assets\.logocdn\.com\/images\/sports\/(nba|nfl)\/(\d{4})\/([a-z0-9-]+)(?:@3x|%403x)?\.(?:svg|png|webp)/gi;

export function normalizeArchiveTeam(value: string) {
  return value.toLowerCase().replace(/^la(\s|(?=[a-z]))/, "los angeles ").replace(/[^a-z0-9]/g, "");
}
function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Historical franchise names are explicit, never inferred by partial fuzzy matches.
const FORMER_NAMES: Record<string, string[]> = {
  "los-angeles-clippers": ["san-diego-clippers", "buffalo-braves"],
  "los-angeles-lakers": ["minneapolis-lakers"],
  "new-orleans-pelicans": ["new-orleans-hornets", "new-orleans-oklahoma-city-hornets"],
  "brooklyn-nets": ["new-jersey-nets", "new-york-nets", "new-jersey-americans"],
  "memphis-grizzlies": ["vancouver-grizzlies"],
  "oklahoma-city-thunder": ["seattle-supersonics"],
  "golden-state-warriors": ["san-francisco-warriors", "philadelphia-warriors"],
  "washington-wizards": ["washington-bullets", "capital-bullets", "baltimore-bullets"],
  "sacramento-kings": ["kansas-city-kings", "kansas-city-omaha-kings", "cincinnati-royals", "rochester-royals"],
  "utah-jazz": ["new-orleans-jazz"],
  "atlanta-hawks": ["st-louis-hawks", "milwaukee-hawks", "tri-cities-blackhawks"],
  "detroit-pistons": ["fort-wayne-pistons", "fort-wayne-zollner-pistons"],
  "denver-nuggets": ["denver-rockets"],
  "houston-rockets": ["san-diego-rockets"],
  "philadelphia-76ers": ["syracuse-nationals"],
  "las-vegas-raiders": ["oakland-raiders", "los-angeles-raiders"],
  "los-angeles-chargers": ["san-diego-chargers"],
  "los-angeles-rams": ["st-louis-rams", "cleveland-rams"],
  "arizona-cardinals": ["phoenix-cardinals", "st-louis-cardinals", "chicago-cardinals"],
  "tennessee-titans": ["houston-oilers", "tennessee-oilers"],
  "indianapolis-colts": ["baltimore-colts"],
  "washington-commanders": ["washington-football-team", "washington-redskins"],
  "new-england-patriots": ["boston-patriots"]
};

export function parseHistoricalLogos(html: string, league: "nba" | "nfl"): ArchivedTeam[] {
  const heads = [...html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)];
  const result: ArchivedTeam[] = [];
  for (let i = 0; i < heads.length; i++) {
    const name = heads[i][1].replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim();
    const key = slug(name);
    if (!name || !key) continue;
    const section = html.slice((heads[i].index || 0) + heads[i][0].length,
      i + 1 < heads.length ? heads[i + 1].index : html.length);
    const allowed = new Set([key, ...(FORMER_NAMES[key] || [])]);
    const logos = new Map<string, ArchivedLogo>();
    for (const match of section.matchAll(ASSET)) {
      if (match[1].toLowerCase() !== league || !allowed.has(match[3].toLowerCase())) continue;
      const year = Number(match[2]);
      if (year < 1900 || year > 2026) continue;
      logos.set(match[0], { label: String(year) + " logo", year, url: match[0] });
    }
    if (logos.size) result.push({ name, logos: [...logos.values()].sort((a, b) => b.year - a.year) });
  }
  return result;
}

export function findArchivedTeam(rows: ArchivedTeam[], name: string): ArchivedTeam | undefined {
  const needle = normalizeArchiveTeam(name);
  return rows.find(row => normalizeArchiveTeam(row.name) === needle);
}
