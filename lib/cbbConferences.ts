import type { Game } from "@/lib/types";

export const CBB_POWER_CONFERENCES = ["ACC", "BIG 12", "BIG EAST", "BIG TEN", "SEC"] as const;
export const CBB_MID_CONFERENCES = ["PAC-12", "MOUNTAIN WEST", "AMERICAN", "MISSOURI VALLEY", "ATLANTIC 10"] as const;

export type CbbConferenceMap = {
  teams: Record<string, string>;
  conferences: Array<{ value: string; label: string; category: "POWER" | "MID" | "LOW" }>;
};

/** Short display names for narrow conference filter cells; value stays canonical. */
export function conferenceAbbreviation(name: string): string {
  const aliases: Record<string, string> = {
    "BIG TEN": "BIG TEN", "BIG 10": "BIG TEN", "BIG EAST": "BIG EAST",
    "ATLANTIC 10": "A-10", "MOUNTAIN WEST": "MW", "AMERICAN": "AAC",
    "AMERICAN ATHLETIC": "AAC", "MISSOURI VALLEY": "MVC",
    "HORIZON LEAGUE": "HORIZON", "WEST COAST": "WCC",
    "COLONIAL ATHLETIC": "CAA", "COASTAL ATHLETIC": "CAA",
    "COASTAL ATHLETIC ASSOCIATION": "CAA", "CONFERENCE USA": "C-USA",
    "MID-AMERICAN": "MAC", "SOUTHERN": "SOCON", "SOUTHLAND": "SOUTHLAND",
    "NORTHEAST": "NEC", "OHIO VALLEY": "OVC", "BIG SOUTH": "BIG SOUTH",
    "BIG SKY": "BIG SKY", "METRO ATLANTIC ATHLETIC": "MAAC",
    "METRO ATLANTIC ATHLETIC CONFERENCE": "MAAC",
    "AMERICA EAST": "AM. EAST", "SUMMIT LEAGUE": "SUMMIT",
    "WESTERN ATHLETIC": "WAC", "SOUTHWESTERN ATHLETIC": "SWAC",
    "MID-EASTERN ATHLETIC": "MEAC", "MID EASTERN ATHLETIC": "MEAC",
    "ASUN": "ASUN", "ATLANTIC SUN": "ASUN",
    "UNITED ATHLETIC": "UAC", "UNITED ATHLETIC CONFERENCE": "UAC",
    "BIG WEST": "BIG WEST", "IVY LEAGUE": "IVY",
    "PATRIOT LEAGUE": "PATRIOT", "SOUTHEASTERN": "SEC",
    "ATLANTIC COAST": "ACC", "PACIFIC 12": "PAC-12",
    "WESTERN COAST": "WCC"
  };
  const normalized = name.toUpperCase().replace(/\s+CONFERENCE$/, "").trim();
  return aliases[normalized] ?? normalized;
}

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
