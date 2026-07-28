const TEAM_IDS_BY_CONFERENCE: Record<string, readonly string[]> = {
  AMERICAN: ["5", "58", "151", "202", "218", "235", "242", "249", "349", "2226", "2426", "2429", "2636", "2655"],
  ACC: ["24", "25", "52", "59", "97", "103", "150", "152", "153", "154", "183", "221", "228", "258", "259", "2390", "2567"],
  "BIG 12": ["9", "12", "38", "66", "197", "239", "248", "252", "254", "277", "2116", "2132", "2305", "2306", "2628", "2641"],
  "BIG TEN": ["26", "30", "77", "84", "120", "127", "130", "135", "158", "164", "194", "213", "264", "275", "356", "2294", "2483", "2509"],
  CUSA: ["48", "55", "98", "166", "338", "2229", "2335", "2393", "2534", "2623"],
  IND: ["41", "87"],
  MAC: ["16", "113", "189", "193", "195", "2006", "2050", "2084", "2117", "2199", "2309", "2649", "2711"],
  MWC: ["23", "62", "167", "2005", "2439", "2440", "2449", "2459", "2638", "2751"],
  "PAC-12": ["21", "36", "68", "204", "265", "278", "326", "328"],
  SEC: ["2", "8", "57", "61", "96", "99", "142", "145", "201", "238", "245", "251", "333", "344", "2579", "2633"],
  "SUN BELT": ["6", "256", "276", "290", "295", "309", "324", "2026", "2032", "2247", "2348", "2433", "2572", "2653"],
  "BIG SKY": ["13", "70", "147", "149", "253", "302", "304", "331", "2458", "2464", "2502", "2692", "3101"],
  CAA: ["119", "160", "227", "311", "399", "2097", "2210", "2261", "2405", "2448", "2529", "2619", "2803"],
  "FCS IND.": ["2130", "2771"],
  IVY: ["43", "108", "159", "163", "171", "172", "219", "225"],
  MEAC: ["47", "2169", "2415", "2428", "2450", "2569"],
  MVFC: ["79", "93", "155", "233", "282", "2287", "2460", "2571", "2754"],
  NEC: ["284", "2115", "2184", "2341", "2385", "2441", "2523", "2681"],
  "OVC-BIG SOUTH": ["2127", "2197", "2241", "2546", "2630", "2634", "2710", "2815"],
  PATRIOT: ["46", "107", "222", "257", "322", "2083", "2142", "2230", "2329", "2729"],
  PIONEER: ["56", "301", "2086", "2166", "2168", "2181", "2368", "2413", "2506", "2674", "2900"],
  SOUTHERN: ["231", "236", "2193", "2382", "2535", "2635", "2643", "2678", "2717", "2747"],
  SOUTHLAND: ["292", "2277", "2320", "2377", "2447", "2466", "2545", "2617", "2837", "2916"],
  SWAC: ["50", "2010", "2011", "2016", "2029", "2065", "2296", "2400", "2504", "2582", "2640", "2755"],
  UAC: ["2000", "2046", "2110", "2198", "2453", "2627", "2698", "110242"]
};

export const POWER_CONFERENCES = ["ACC", "BIG 12", "BIG TEN", "PAC-12", "SEC"] as const;
export const GROUP_CONFERENCES = ["AMERICAN", "CUSA", "MAC", "MWC", "SUN BELT"] as const;
export const FBS_INDEPENDENTS_CONFERENCE = "IND";

const FBS_CONFERENCES = new Set<string>([
  ...POWER_CONFERENCES,
  ...GROUP_CONFERENCES,
  FBS_INDEPENDENTS_CONFERENCE
]);

const CONFERENCE_BY_TEAM_ID = new Map(
  Object.entries(TEAM_IDS_BY_CONFERENCE).flatMap(([conference, teamIds]) =>
    teamIds.map((teamId) => [teamId, conference] as const)
  )
);

function teamIdFromLogo(logoUrl: string | null | undefined) {
  return logoUrl?.match(/\/(\d+)\.png(?:[?#]|$)/)?.[1] || null;
}

export function cfbConferenceForLogo(logoUrl: string | null | undefined) {
  const teamId = teamIdFromLogo(logoUrl);
  return teamId ? CONFERENCE_BY_TEAM_ID.get(teamId) || null : null;
}

export type CfbSubdivision = "FBS" | "FCS";

export function cfbSubdivisionForLogo(logoUrl: string | null | undefined): CfbSubdivision | null {
  const conference = cfbConferenceForLogo(logoUrl);
  if (!conference) return null;
  return FBS_CONFERENCES.has(conference) ? "FBS" : "FCS";
}

export function isDivisionOneCfbMatchup(game: {
  league: string;
  home_logo_url?: string | null;
  away_logo_url?: string | null;
}) {
  return game.league !== "CFB" || Boolean(
    cfbSubdivisionForLogo(game.home_logo_url) &&
    cfbSubdivisionForLogo(game.away_logo_url)
  );
}

export function isFbsTeamGame(game: {
  league: string;
  home_logo_url?: string | null;
  away_logo_url?: string | null;
}) {
  if (game.league !== "CFB") return true;
  const homeSubdivision = cfbSubdivisionForLogo(game.home_logo_url);
  const awaySubdivision = cfbSubdivisionForLogo(game.away_logo_url);
  return Boolean(
    homeSubdivision &&
    awaySubdivision &&
    (homeSubdivision === "FBS" || awaySubdivision === "FBS")
  );
}
