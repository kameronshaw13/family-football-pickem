import { teamDisplayName } from "./teamNames";

/** The score row and background typography show school or location, not mascot. */
const PRO_NICKNAMES = /\s+(?:Trail Blazers|Golden State Warriors|New Orleans Pelicans|New York Knicks|Los Angeles Lakers|Los Angeles Clippers|76ers|Bulls|Bengals|Bills|Broncos|Browns|Buccaneers|Cardinals|Cavaliers|Chargers|Chiefs|Colts|Commanders|Cowboys|Celtics|Dolphins|Eagles|Falcons|Giants|Grizzlies|Heat|Hornets|Jaguars|Jazz|Jets|Kings|Knicks|Lakers|Lions|Magic|Mavericks|Nets|Nuggets|Packers|Pacers|Panthers|Patriots|Pelicans|Pistons|Raiders|Rams|Raptors|Ravens|Rockets|Saints|Seahawks|Spurs|Steelers|Suns|Texans|Thunder|Timberwolves|Titans|Vikings|Warriors|Wizards|49ers)$/i;
export function trackerInstitutionName(league: string, rawName: string): string {
  if (league === "CFB" || league === "CBB") return teamDisplayName(league, rawName);
  const location = rawName.trim().replace(PRO_NICKNAMES, "").trim();
  return location || rawName;
}
