/**
 * On-demand historic college-logo discovery. Only match a complete school/team
 * identity on a known NCAA directory page; never guess by a shared mascot.
 * The archive remains remote and is requested only when someone opens a team.
 */
export type VintageSchoolOption = { label: string; url: string; year: number; source: string };
export type VintageCandidate = { url: string; year: number; kind: "Primary" | "Alternate" | "Secondary" };

const DIRECTORY: Record<string, string> = {
  ac: "https://www.sportslogos.net/teams/list_by_league/30/NCAA-Division-I-a-c-Logos/NCAA-a-c-Logos/",
  dh: "https://www.sportslogos.net/teams/list_by_league/31/NCAA-Division-I-d-h-Logos/NCAA-d-h-Logos/",
  in: "https://www.sportslogos.net/teams/list_by_league/32/NCAA-Division-I-i-n-Logos/NCAA-i-n-Logos/",
  or: "https://www.sportslogos.net/teams/list_by_league/33/NCAA-Division-I-o-r-Logos/NCAA-o-r-Logos/",
  st: "https://www.sportslogos.net/teams/list_by_league/34/NCAA-Division-I-s-t-Logos/NCAA-s-t-Logos/",
  uz: "https://www.sportslogos.net/teams/list_by_league/35/NCAA-Division-I-u-z-Logos/NCAA-u-z-Logos/"
};

const clean = (name: string) => name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
  .replace(/&amp;/g,"and").replace(/[^a-z0-9]/g, "");
function alias(name: string) {
  return clean(name)
    .replace(/^ucriversidehighlanders$/, "californiariversidehighlanders")
    .replace(/^texasamcommerce/, "amcommercelions")
    .replace(/^wichitastate/, "wichitastate");
}
function codeForName(name: string) {
  const c = name[0]?.toLowerCase();
  if (!c || c < "d") return "ac";
  if (c <= "h") return "dh";
  if (c <= "n") return "in";
  if (c <= "r") return "or";
  if (c <= "t") return "st";
  return "uz";
}
export function collegeDirectoryUrls(name: string) {
  const first = codeForName(name);
  // UC Riverside appears under California in the historical directory.
  return [DIRECTORY[first], ...(alias(name).startsWith("californiariverside") && first !== "ac" ? [DIRECTORY.ac] : [])];
}
export function matchHistoricCollegeDirectory(html: string, school: string) {
  const needle = alias(school);
  // Use the team slug rather than nearby content or fuzzy school-name guesses.
  const teamLink = /(?:https?:\/\/www\.sportslogos\.net)?\/logos\/list_by_team\/(\d+)\/([a-z0-9-]+-Logos)\/?/gi;
  for (const match of html.matchAll(teamLink)) {
    const team = alias(match[2].replace(/-Logos$/i, "").replace(/-/g, " "));
    if (needle === team) return {
      teamId: match[1], url: "https://www.sportslogos.net/logos/list_by_team/" + match[1] + "/" + match[2] + "/"
    };
  }
  return null;
}
export function historicCollegeCandidates(html: string, teamId: string): VintageCandidate[] {
  // Team id prefix in the image page identifier prevents cross-team matches.
  const link = /(?:https?:\/\/www\.sportslogos\.net)?(\/logos\/view\/([a-z0-9]+)\/[a-z0-9-]+\/((?:19|20)\d{2})\/(Primary|Alternate|Secondary)-Logo)\/?/gi;
  const unique = new Map<string,VintageCandidate>();
  for (const match of html.matchAll(link)) {
    const year = Number(match[3]);
    if (year >= 2020 || year < 1900 || !match[2].toLowerCase().startsWith(teamId)) continue;
    const url = "https://www.sportslogos.net" + match[1];
    if (!unique.has(url)) unique.set(url, { year, kind: match[4] as VintageCandidate["kind"], url });
  }
  const sorted = [...unique.values()].sort((a,b)=>a.year-b.year);
  const primary = sorted.filter(x=>x.kind==="Primary");
  const others = sorted.filter(x=>x.kind!=="Primary");
  // Mix decades and marks while capping remote detail requests.
  const picked = [ ...primary.slice(0,3), ...primary.slice(-2), ...others.slice(0,4)];
  return [...new Map(picked.map(x=>[x.url,x])).values()].slice(0,9);
}

export function historicLogoImageFromDetail(html: string, teamId: string, year: number): string | null {
  const expanded = html.replace(/&amp;/g,"&").replace(/\\\//g,"/");
  const re = new RegExp("https://content\\\\.sportslogos\\\\.net/logos/\\\\d+/" + teamId + "/full/[^\\\\s\\\"'<>]+?\\\\.(?:png|gif|webp|jpg)", "gi");
  const urls = [...expanded.matchAll(re)].map(x=>x[0]).filter(x=>!x.includes("?"));
  return urls.find(x=>x.includes(String(year))) || urls[0] || null;
}

export async function loadHistoricCollegeImages(teamName: string): Promise<VintageSchoolOption[]> {
  const fetchText = async (url: string) => {
    const res = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(6500) });
    if (!res.ok) throw Error("Logo history unavailable");
    return (await res.text()).slice(0, 600000);
  };
  let team: {teamId: string; url: string} | null = null;
  for (const directory of collegeDirectoryUrls(teamName)) {
    try {
      team = matchHistoricCollegeDirectory(await fetchText(directory), teamName);
      if (team) break;
    } catch { /* A missing directory must not change other team logos. */ }
  }
  if (!team) return [];
  const history = historicCollegeCandidates(await fetchText(team.url), team.teamId);
  const results = await Promise.all(history.map(async item => {
    try {
      const image = historicLogoImageFromDetail(await fetchText(item.url), team!.teamId, item.year);
      return image ? { label: item.year + " " + item.kind, url: image, year: item.year, source: "SportsLogos.Net" } : null;
    } catch { return null; }
  }));
  return results.filter((x): x is VintageSchoolOption => x !== null);
}
