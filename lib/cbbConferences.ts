import type { Game } from "@/lib/types";

export const CBB_POWER_CONFERENCES = ["ACC", "BIG 12", "BIG EAST", "BIG TEN", "SEC"] as const;
export const CBB_MID_CONFERENCES = ["PAC-12", "MOUNTAIN WEST", "AMERICAN", "MISSOURI VALLEY", "ATLANTIC 10"] as const;

const CBB_CONFERENCE_SHORT_NAMES: Record<string, string> = {
  "BIG 12": "B12", "BIG EAST": "BE", "BIG TEN": "B1G", "PAC-12": "P12",
  "MOUNTAIN WEST": "MWC", "AMERICAN": "AAC", "MISSOURI VALLEY": "MVC", "ATLANTIC 10": "A-10",
  "AMERICA EAST": "AE", "ATLANTIC SUN": "ASUN", "ASUN": "ASUN", "BIG SKY": "BSKY",
  "BIG SOUTH": "BSOUTH", "BIG WEST": "BW", "COASTAL ATHLETIC": "CAA", "COLONIAL ATHLETIC": "CAA",
  "CONFERENCE USA": "CUSA", "HORIZON": "HL", "IVY LEAGUE": "IVY", "METRO ATLANTIC ATHLETIC": "MAAC",
  "MID AMERICAN": "MAC", "MID-AMERICAN": "MAC", "MID EASTERN ATHLETIC": "MEAC", "MID-EASTERN ATHLETIC": "MEAC", "NORTHEAST": "NEC",
  "OHIO VALLEY": "OVC", "PATRIOT LEAGUE": "PATRIOT", "SOUTHLAND": "SLC", "SOUTHERN": "SOCON",
  "SUMMIT LEAGUE": "SUMMIT", "SUN BELT": "SBC", "SOUTHWESTERN ATHLETIC": "SWAC",
  "WEST COAST": "WCC", "WESTERN ATHLETIC": "WAC"
};

export function cbbConferenceAbbreviation(name: string): string {
  const normalized = name.toUpperCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
  return CBB_CONFERENCE_SHORT_NAMES[normalized] || name;
}

export type CbbConferenceMap = {
  teams: Record<string, string>;
  conferences: Array<{ value: string; label: string; category: "POWER" | "MID" | "LOW" }>;
};

export function cbbConferenceName(name: string): string {
  const value = name.toLowerCase().replace(/[–—-]/g, " ").replace(/\s+/g, " ").trim();
  if (/^(acc|atlantic coast)( conference)?$/.test(value)) return "ACC";
  if (/^big 12( conference)?$/.test(value)) return "BIG 12";
  if (/^big east( conference)?$/.test(value)) return "BIG EAST";
  if (/^big ten( conference)?$/.test(value)) return "BIG TEN";
  if (/^(sec|southeastern)( conference)?$/.test(value)) return "SEC";
  if (/^pac(ific)?\s*(12|twelve)( conference)?$/.test(value)) return "PAC-12";
  if (/^(mountain west|mwc)( conference)?$/.test(value)) return "MOUNTAIN WEST";
  if (/^(american|american athletic)( conference)?$/.test(value)) return "AMERICAN";
  if (/^(missouri valley|mvc)( conference)?$/.test(value)) return "MISSOURI VALLEY";
  if (/^(atlantic 10|a 10)( conference)?$/.test(value)) return "ATLANTIC 10";
  return name.replace(/\s+Conference$/i, "").trim().toUpperCase();
}
export function cbbConferenceTier(value: string): "POWER" | "MID" | "LOW" {
  if ((CBB_POWER_CONFERENCES as readonly string[]).includes(value)) return "POWER";
  if ((CBB_MID_CONFERENCES as readonly string[]).includes(value)) return "MID";
  return "LOW";
}

export function collegeBasketballTeamIdFromLogo(value: string | null | undefined): string | null {
  const path = value?.match(/\/(\d+)(?:\.(?:png|svg|webp)|\?|$)/i)?.[1];
  return path || null;
}
export function cbbGameMatchesConference(game: Game, value: string, teams: Record<string, string>): boolean {
  if (value === "ALL") return true;
  if (value === "TOP25") return [game.away_rank, game.home_rank].some(rank => {
    const num = Number(rank);
    return rank != null && Number.isInteger(num) && num >= 1 && num <= 25;
  });
  const conferences = [game.away_logo_url, game.home_logo_url]
    .map(url => collegeBasketballTeamIdFromLogo(url))
    .map(id => id ? teams[id] : null)
    .filter((conference): conference is string => Boolean(conference));
  if (value === "POWER" || value === "MID" || value === "LOW") return conferences.some(conference => cbbConferenceTier(conference) === value);
  return conferences.includes(value);
}
