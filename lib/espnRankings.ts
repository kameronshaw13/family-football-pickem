function teamIdFromLogo(logoUrl: string | null | undefined) {
  return logoUrl?.match(/\/(\d+)\.png(?:[?#]|$)/)?.[1] || null;
}

export type EspnCfbRankMap = Map<string, number>;

export async function fetchEspnCfbRankMap(): Promise<EspnCfbRankMap> {
  const url = "https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings";
  const response = await fetch(url, { next: { revalidate: 15 * 60 } });
  if (!response.ok) return new Map();

  const payload = await response.json();
  const polls = Array.isArray(payload?.rankings) ? payload.rankings : [];
  const ap = polls.find((poll: any) => /\bAP\b/i.test(String(poll?.name || poll?.shortName || ""))) || polls[0];
  const ranks = Array.isArray(ap?.ranks) ? ap.ranks : [];
  const result = new Map<string, number>();

  for (const entry of ranks) {
    const teamId = String(entry?.team?.id || "");
    const rank = Number(entry?.current);
    if (!teamId || !Number.isInteger(rank) || rank < 1 || rank > 25) continue;
    result.set(teamId, rank);
  }
  return result;
}

export function espnRankForLogo(rankMap: EspnCfbRankMap, logoUrl: string | null | undefined) {
  const teamId = teamIdFromLogo(logoUrl);
  return teamId ? rankMap.get(teamId) || null : null;
}
