/**
 * SportsLogoHistory.com exposes team-specific historical college-logo images,
 * including years in each image's alt text. We only accept imagery whose
 * school name matches the requested school exactly.
 *
 * The previous SportsLogos.Net HTML directory returned HTTP 403 on Vercel,
 * so it could not discover older logos despite them existing in its archive.
 */
export type VintageSchoolOption = { label: string; url: string; year: number; source: string };

const ALIASES: Record<string, string[]> = {
  "easttexasam": ["texas-am-commerce-lions"],
  "easttexasamlions": ["texas-am-commerce-lions"],
  "texasamcommercelions": ["east-texas-am-lions"],
  "ucirvineanteaters": ["california-irvine-anteaters"],
  "ucriversidehighlanders": ["california-riverside-highlanders"],
  "ucdavisaggies": ["california-davis-aggies"],
  "ucsandiegotritons": ["california-san-diego-tritons"],
  "ucsantabarbaragauchos": ["california-santa-barbara-gauchos"],
  "californiariversidehighlanders": ["uc-riverside-highlanders"],
  "californiairvineanteaters": ["uc-irvine-anteaters"],
  "umkckangaroos": ["kansas-city-roos"],
  "kansascityroos": ["umkc-kangaroos"],
  "utsaroadrunners": ["texas-san-antonio-roadrunners"],
  "utepminers": ["texas-el-paso-miners"],
  "utrgvvaqueros": ["texas-rio-grande-valley-vaqueros"],
  "unlvrebels": ["nevada-las-vegas-rebels"],
  "lsutigers": ["louisiana-state-tigers"],
  "byucougars": ["brigham-young-cougars"],
  "vcurams": ["virginia-commonwealth-rams"],
  "umassminutemen": ["massachusetts-minutemen"],
  "ncstatewolfpack": ["north-carolina-state-wolfpack"],
  "uncgspartans": ["north-carolina-greensboro-spartans"],
  "uncwseahawks": ["north-carolina-wilmington-seahawks"],
  "siuecougars": ["southern-illinois-edwardsville-cougars"],
  "fgcueagles": ["florida-gulf-coast-eagles"],
  "fduknights": ["fairleigh-dickinson-knights"],
  "longislandsharks": ["liu-sharks"],
  "liusharks": ["long-island-sharks"]
};

const FORMER_SCHOOL_NAMES: Record<string,string[]> = {
  "easttexasamlions": ["texasamcommercelions", "easttexasstatelions"],
  "kansascityroos": ["umkckangaroos", "kansascitykangaroos"],
  "longislandsharks": ["liusharks", "librooklynblackbirds", "liupostpioneers"],
  "uc riversidehighlanders": ["californiariversidehighlanders"],
  "ucriversidehighlanders": ["californiariversidehighlanders"]
};

export function normalizedSchool(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/&amp;/g, "&").replace(/&/g,"").replace(/[^a-z0-9]/g,"");
}
function slug(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}
export function vintageSchoolSlugs(name: string): string[] {
  const direct = slug(name);
  const possibilities = [direct, ...(ALIASES[normalizedSchool(name)] || [])];
  if (/\bst\./i.test(name)) possibilities.push(slug(name.replace(/\bst\./gi, "Saint")));
  if (/\bsaint\b/i.test(name)) possibilities.push(slug(name.replace(/\bsaint\b/gi, "St")));
  return [...new Set(possibilities)].filter(Boolean).slice(0, 4);
}

function attribute(tag: string, name: string): string {
  const result = tag.match(new RegExp("\\b" + name + "\\s*=\\s*([\"'])(.*?)\\1", "i"));
  return result?.[2]?.replace(/&amp;/g,"&").replace(/&#39;/g,"'").replace(/&quot;/g,'"') || "";
}

/**
 * Parse only logo <img>s from the exact school's history page.
 * Other img elements (ad banners, site logos and poll icons) never qualify.
 */
export function parseCollegeHistoryHtml(
  html: string, schoolName: string, kind: "Primary" | "Alternate" | "Wordmark"
): VintageSchoolOption[] {
  const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    ?.replace(/<[^>]*>/g, "").trim() || "";
  const expected = normalizedSchool(schoolName);
  if (!expected || !normalizedSchool(heading).startsWith(expected + "logohistory")) return [];
  const acceptedSchoolNames = new Set([expected, ...(FORMER_SCHOOL_NAMES[expected] || [])]);
  const logos = new Map<string,VintageSchoolOption>();
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const alt = attribute(tag, "alt");
    if (![...acceptedSchoolNames].some(school => normalizedSchool(alt).startsWith(school + kind.toLowerCase() + "logo"))) continue;
    const year = Number(alt.match(/(?:19|20)\d{2}/)?.[0] || 0);
    if (year < 1900 || year > 2023) continue;
    const src = attribute(tag,"src") || attribute(tag,"data-src");
    try {
      const url = new URL(src);
      if (url.protocol !== "https:" || url.hostname !== "sportslogohistory.com"
          || !/^\/wp-content\/uploads\/\d{4}\/\d{2}\/[a-z0-9_.-]+\.(?:png|webp|jpe?g)$/i.test(url.pathname)
          || /-\d+x\d+\.(?:png|webp|jpe?g)$/i.test(url.pathname))
        continue;
      logos.set(url.href, { label: year + " " + kind, url: url.href, year, source: "SportsLogoHistory.com" });
    } catch { /* Ignore non-image and external advertising URLs. */ }
  }
  return [...logos.values()].sort((a,b)=>a.year-b.year);
}

async function fetchPage(url: string) {
  const result = await fetch(url, {
    headers: { "Accept": "text/html", "User-Agent": "Mozilla/5.0 (compatible; FamilyPickemLogoStudio/1.0)" },
    next: { revalidate: 86400 }, signal: AbortSignal.timeout(7000)
  });
  if (!result.ok) return "";
  if (new URL(result.url).hostname !== "sportslogohistory.com") return "";
  return (await result.text()).slice(0, 850_000);
}

export async function loadHistoricCollegeImages(teamName: string): Promise<VintageSchoolOption[]> {
  for (const schoolSlug of vintageSchoolSlugs(teamName)) {
    const exactSchool = schoolSlug.replace(/-/g," ");
    let primary = "";
    try {
      primary = await fetchPage("https://sportslogohistory.com/" + schoolSlug + "-primary-logo/");
    } catch { continue; }
    const original = parseCollegeHistoryHtml(primary, exactSchool, "Primary");
    // A 200 error or another school's page is not accepted as a match.
    if (!original.length) continue;
    const variants = await Promise.all((["alternate", "wordmark"] as const).map(async kind => {
      try {
        const html = await fetchPage("https://sportslogohistory.com/" + schoolSlug + "-" + kind + "-logo/");
        return parseCollegeHistoryHtml(html, exactSchool, kind === "alternate" ? "Alternate" : "Wordmark");
      } catch { return [] as VintageSchoolOption[]; }
    }));
    return [...new Map(
      [...original.slice(0,7), ...variants[0].slice(0,6), ...variants[1].slice(0,3)]
        .map(option=>[option.url, option])
    ).values()].slice(0,16);
  }
  return [];
}
