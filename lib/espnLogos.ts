type ESPNTeamLogo = {
  displayName: string;
  location: string;
  nickname: string;
  shortName: string;
  abbreviation: string;
  logoUrl: string | null;
  aliases: string[];
  exactOnlyAliases: string[];
};

const STOP_WORDS = new Set(["the", "of", "university", "college", "state", "st", "and", "at"]);
const COMMON_MASCOTS = new Set([
  "tigers", "wildcats", "bulldogs", "eagles", "hawks", "falcons", "panthers", "cougars", "bears", "lions", "rams", "aggies", "spartans", "trojans", "cardinals", "pirates", "knights", "warriors", "raiders", "rebels", "mustangs", "owls"
]);

const MANUAL_CFB_LOGOS = new Map<string, string>([
  ["san jose state", "https://a.espncdn.com/i/teamlogos/ncaa/500/23.png"],
  ["san jose", "https://a.espncdn.com/i/teamlogos/ncaa/500/23.png"],
  ["sjsu", "https://a.espncdn.com/i/teamlogos/ncaa/500/23.png"],
  ["hawaii", "https://a.espncdn.com/i/teamlogos/ncaa/500/62.png"],
  ["hawaii rainbow warriors", "https://a.espncdn.com/i/teamlogos/ncaa/500/62.png"],
  ["memphis", "https://a.espncdn.com/i/teamlogos/ncaa/500/235.png"],
  ["memphis tigers", "https://a.espncdn.com/i/teamlogos/ncaa/500/235.png"],
  ["auburn", "https://a.espncdn.com/i/teamlogos/ncaa/500/2.png"],
  ["auburn tigers", "https://a.espncdn.com/i/teamlogos/ncaa/500/2.png"]
]);

function normalize(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/hawai[\s'’`-]*i/g, "hawaii")
    .replace(/\bsan jos\b/g, "san jose")
    .replace(/\bst\.?\b/g, "state")
    .replace(/\bmiami fl\b/g, "miami")
    .replace(/\bmiami florida\b/g, "miami")
    .replace(/\bmississippi\b/g, "miss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string) {
  return normalize(value).split(" ").filter((token) => token && !STOP_WORDS.has(token));
}

function logoFromTeam(team: any) {
  const logos = team?.logos || [];
  const preferred = logos.find((logo: any) => typeof logo?.href === "string" && (!logo.rel || logo.rel.includes("default"))) || logos[0];
  return preferred?.href || null;
}

function uniq(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((v) => (v || "").trim()).filter(Boolean)));
}

async function fetchTeams(league: "NFL" | "CFB") {
  const sportPath = league === "NFL" ? "nfl" : "college-football";
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/${sportPath}/teams?limit=1000`;
  const response = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
  if (!response.ok) return [];
  const payload = await response.json();
  return payload?.sports?.[0]?.leagues?.[0]?.teams || [];
}

export async function fetchEspnLogoMap(league: "NFL" | "CFB") {
  const teams = await fetchTeams(league);
  const records: ESPNTeamLogo[] = teams.map((item: any) => {
    const team = item.team || item;
    const displayName = team.displayName || "";
    const location = team.location || "";
    const nickname = team.name || "";
    const shortName = team.shortDisplayName || team.shortName || "";
    const abbreviation = team.abbreviation || "";

    // For college, never use mascot-only fuzzy aliases like "Tigers" as a primary key.
    // That caused Memphis to match Auburn because both are Tigers.
    const strongAliases = uniq([
      displayName,
      shortName,
      location,
      abbreviation,
      `${location} ${nickname}`,
      displayName.replace(/\b(The )/i, "")
    ]);

    const exactOnlyAliases = league === "NFL" ? uniq([nickname]) : [];

    return {
      displayName,
      location,
      nickname,
      shortName,
      abbreviation,
      logoUrl: logoFromTeam(team),
      aliases: strongAliases,
      exactOnlyAliases
    };
  }).filter((team: ESPNTeamLogo) => team.logoUrl);

  const map = new Map<string, string>();
  for (const record of records) {
    for (const alias of record.aliases) {
      const key = normalize(alias);
      if (key && record.logoUrl) map.set(key, record.logoUrl);
    }
    for (const alias of record.exactOnlyAliases) {
      const key = normalize(alias);
      if (key && record.logoUrl) map.set(`exact:${key}`, record.logoUrl);
    }
  }

  if (league === "CFB") {
    for (const [alias, logo] of Array.from(MANUAL_CFB_LOGOS.entries())) {
      map.set(normalize(alias), logo);
    }
  }

  // Keep the full records as JSON in a private map entry so findEspnLogo can score safely.
  map.set("__records__", JSON.stringify(records));
  return map;
}

function scoreAlias(teamKey: string, alias: string) {
  const aliasKey = normalize(alias);
  if (!aliasKey) return 0;
  if (teamKey === aliasKey) return 100;
  if (teamKey.includes(aliasKey) && aliasKey.length >= 5) return 90;
  if (aliasKey.includes(teamKey) && teamKey.length >= 5) return 86;

  const teamTokens = new Set(tokens(teamKey));
  const aliasTokens = tokens(aliasKey);
  if (!aliasTokens.length || !teamTokens.size) return 0;

  let overlap = 0;
  for (const token of aliasTokens) {
    if (teamTokens.has(token)) overlap += 1;
  }

  if (!overlap) return 0;

  // Do not match only on common mascots like Tigers, Wildcats, Bulldogs, etc.
  if (overlap === 1) {
    const only = aliasTokens.find((token) => teamTokens.has(token));
    if (only && COMMON_MASCOTS.has(only)) return 0;
  }

  return Math.round((overlap / Math.max(aliasTokens.length, teamTokens.size)) * 78);
}

export function findEspnLogo(teamName: string, logoMap: Map<string, string>) {
  const key = normalize(teamName);
  if (!key) return null;

  const manual = MANUAL_CFB_LOGOS.get(key);
  if (manual) return manual;
  if (logoMap.has(key)) return logoMap.get(key) || null;
  const exactNickname = logoMap.get(`exact:${key}`);
  if (exactNickname) return exactNickname;

  const recordsRaw = logoMap.get("__records__");
  if (!recordsRaw) return null;

  let records: ESPNTeamLogo[] = [];
  try {
    records = JSON.parse(recordsRaw) as ESPNTeamLogo[];
  } catch {
    return null;
  }

  let best: { score: number; logo: string | null; name: string } = { score: 0, logo: null, name: "" };
  for (const record of records) {
    for (const alias of record.aliases) {
      const score = scoreAlias(key, alias);
      if (score > best.score) best = { score, logo: record.logoUrl, name: record.displayName };
    }
  }

  // Require a strong match. Better to show no logo than the wrong logo.
  return best.score >= 70 ? best.logo : null;
}
