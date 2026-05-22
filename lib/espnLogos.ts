type ESPNTeamLogo = {
  displayName: string;
  logoUrl: string | null;
  aliases: string[];
};

function normalize(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function logoFromTeam(team: any) {
  const logos = team?.logos || [];
  const preferred = logos.find((logo: any) => typeof logo?.href === "string" && (!logo.rel || logo.rel.includes("default"))) || logos[0];
  return preferred?.href || null;
}

export async function fetchEspnLogoMap(league: "NFL" | "CFB") {
  const sportPath = league === "NFL" ? "nfl" : "college-football";
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/${sportPath}/teams`;
  const response = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
  if (!response.ok) return new Map<string, string>();
  const payload = await response.json();
  const teams = payload?.sports?.[0]?.leagues?.[0]?.teams || [];
  const records: ESPNTeamLogo[] = teams.map((item: any) => {
    const team = item.team || item;
    const aliases = [
      team.displayName,
      team.name,
      team.shortDisplayName,
      team.location,
      team.abbreviation,
      `${team.location || ""} ${team.name || ""}`.trim()
    ].filter(Boolean);
    return { displayName: team.displayName, logoUrl: logoFromTeam(team), aliases };
  }).filter((team: ESPNTeamLogo) => team.logoUrl);

  const map = new Map<string, string>();
  for (const record of records) {
    for (const alias of record.aliases) {
      const key = normalize(alias);
      if (key && record.logoUrl) map.set(key, record.logoUrl);
    }
  }

  return map;
}

export function findEspnLogo(teamName: string, logoMap: Map<string, string>) {
  const key = normalize(teamName);
  if (logoMap.has(key)) return logoMap.get(key) || null;

  for (const [alias, logo] of Array.from(logoMap.entries())) {
    if (alias.length > 3 && (key.includes(alias) || alias.includes(key))) return logo;
  }
  return null;
}
