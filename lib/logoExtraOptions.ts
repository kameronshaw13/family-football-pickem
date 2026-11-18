import { NBA_SVG_BY_ESPN_KEY, NFL_SVG_BY_ESPN_KEY } from "./proLogos.ts";

export type LogoAlternative = { label: string; url: string; source: string };

export function curatedLogoAlternatives(source: string, league: string): LogoAlternative[] {
  const options: LogoAlternative[] = [];
  const add = (label: string, url: string | null | undefined, provider: string) => {
    if (url && !options.some(option => option.url === url)) options.push({ label, url, source: provider });
  };
  const logo = source.match(/\/teamlogos\/(nba|nfl|ncaa)\/(?:[^/?#]+\/)*([^/?.#]+)\.(?:png|svg|webp)(?:[?#]|$)/i);
  const sport = logo?.[1].toLowerCase();
  const key = logo?.[2].toLowerCase();
  // ESPN's full-size logo can differ from its compact scoreboard artwork.
  if (source.includes("/scoreboard/")) add("ESPN full-size", source.replace("/scoreboard/", "/"), "ESPN");
  if (league === "NBA" && sport === "nba" && key) {
    add("Official NBA vector", NBA_SVG_BY_ESPN_KEY[key], "NBA");
    if (["12", "lac"].includes(key)) {
      // Full roundel, not the standalone ship icon. Confirmed by the source's own asset listing.
      add("Clippers full round crest", "https://www.footylogos.com/sports-assets/logos/los-angeles-clippers/los-angeles-clippers-logo-footylogos.svg", "FootyLogos");
      add("Clippers ship + C", "https://www.footylogos.com/sports-assets/variants/los-angeles-clippers/los-angeles-clippers-symbol-logo-footylogos.svg", "FootyLogos");
    }
    if (["13", "lal"].includes(key)) {
      add("Lakers basketball L", "https://content.sportslogos.net/logos/6/237/full/g4it82hxi9dg55krqieloy4io.png", "SportsLogos.Net");
    }
  }
  if (league === "NFL" && sport === "nfl" && key)
    add("NFL vector", NFL_SVG_BY_ESPN_KEY[key], "team-logos GitHub");
  if ((league === "CBB" || league === "CFB") && sport === "ncaa" && key === "2724") {
    add("Wichita State 1948 WuShock", "https://content.sportslogos.net/logos/35/911/full/wichita_state_shockers_logo_primary_1948sportslogosnet9223.png", "SportsLogos.Net");
    add("Wichita State 1959 WuShock", "https://content.sportslogos.net/logos/35/911/full/wichita_state_shockers_logo_primary_1959sportslogosnet1015.png", "SportsLogos.Net");
    add("Wichita State 1964 WuShock", "https://content.sportslogos.net/logos/35/911/full/wichita_state_shockers_logo_primary_1964sportslogosnet4374.png", "SportsLogos.Net");
  }
  if ((league === "CBB" || league === "CFB") && sport === "ncaa" && key === "27") {
    add("UC Riverside bear + UCR (2003)", "https://content.sportslogos.net/logos/30/881/full/dmrfj25w2m6zix6pem8ff70lf.gif", "SportsLogos.Net");
    add("UC Riverside bear head (2003)", "https://content.sportslogos.net/logos/30/881/full/f57l1zt62aatjv62zslxwjmaw.gif", "SportsLogos.Net");
  }
  return options;
}
