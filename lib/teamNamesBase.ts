const NFL_NICKNAMES = [
  "49ers", "Bears", "Bengals", "Bills", "Broncos", "Browns", "Buccaneers", "Cardinals", "Chargers", "Chiefs", "Colts", "Commanders", "Cowboys", "Dolphins", "Eagles", "Falcons", "Giants", "Jaguars", "Jets", "Lions", "Packers", "Panthers", "Patriots", "Raiders", "Rams", "Ravens", "Saints", "Seahawks", "Steelers", "Texans", "Titans", "Vikings"
];

// Mascot/nickname suffixes are removed from college teams so every surface uses
// the same school-only label (for example, "Eastern Michigan Eagles" becomes
// "Eastern Michigan"). Long school names are abbreviated separately, and only
// when the UI determines that the full label does not fit.
const COLLEGE_NICKNAME_SUFFIXES = [
  "Rainbow Warriors", "Rainbow Wahine", "Black Bears", "49ers", "Sharks", "Blue Raiders", "Blue Hens", "Blue Hose", "Blue Devils", "Bluejays", "Green Wave", "Mean Green", "Red Wolves", "Red Raiders", "RedHawks", "Redhawks", "Black Knights", "Golden Hurricane", "Golden Flashes", "Golden Gophers", "Golden Bears", "Golden Eagles", "Golden Knights", "Golden Lions", "Golden Panthers", "Golden Rams", "Golden Grizzlies", "Ragin Cajuns", "Ragin' Cajuns", "Thundering Herd", "Fighting Irish", "Fighting Illini", "Fighting Hawks", "Fighting Camels", "Fighting Blue Hens", "Midshipmen", "Gamecocks", "Mountaineers", "Commodores", "Scarlet Knights", "Yellow Jackets", "Boilermakers", "Nittany Lions", "Tar Heels", "Cardinal", "Sun Devils", "Demon Deacons", "Crimson Tide", "Horned Frogs", "Chanticleers", "Sycamores", "Governors", "Privateers", "Keydets", "Paladins", "Terriers", "Hatters", "Musketeers", "Ramblers", "Explorers", "Billikens", "Jackrabbits", "Leathernecks", "Roadrunners", "Lumberjacks", "Longhorns", "Sooners", "Cyclones", "Buffaloes", "Hurricanes", "Seminoles", "Volunteers", "Razorbacks", "Wolf Pack", "Wolfpack", "Jayhawks", "Buckeyes", "Wolverines", "Badgers", "Hawkeyes", "Hoosiers", "Terrapins", "Cornhuskers", "Flames", "Monarchs", "Miners", "Blazers", "Lobos", "Aztecs", "Bulls", "Zips", "Bobcats", "Rockets", "Chippewas", "Gaels", "Mocs", "Lancers", "Camels", "Seawolves", "Highlanders", "Retrievers", "Pioneers", "Broncs", "Jaspers", "Peacocks", "Salukis", "Flyers", "Penguins", "Vandals", "Mavericks", "Phoenix", "Bison", "Bisons", "Catamounts", "Minutemen", "Jaguars", "Coyotes", "Panthers", "Lions", "Tigers", "Wildcats", "Bulldogs", "Eagles", "Hawks", "Falcons", "Bears", "Bruins", "Rams", "Aggies", "Spartans", "Trojans", "Cardinals", "Pirates", "Knights", "Warriors", "Raiders", "Rebels", "Mustangs", "Owls", "Cougars", "Huskies", "Bearcats", "Bearkats", "Cowboys", "Cowgirls", "Utes", "Ducks", "Beavers", "Hokies", "Cavaliers", "Gators", "Gauchos", "Anteaters", "Matadors", "Titans", "Tritons", "Lopes", "Antelopes", "Vaqueros", "Vaqueras", "Lumberjills", "Colonels", "Racers", "Norfolk", "Dukes", "Dragons", "Quakers", "Big Red", "Crimson", "Bantams", "Engineers", "Statesmen", "Dutchmen", "Saints", "Saint Mary's", "Friars", "Vikings", "Ospreys", "Skyhawks", "Bucs", "Buccaneers", "Hilltoppers", "Hillcats", "Patriots", "Minutewomen", "Greyhounds", "Mules", "Gorillas", "Grit", "Reivers", "Tars", "Royals", "Lakers", "Orange", "Leopards"
].sort((a, b) => b.length - a.length);

const COLLEGE_KEEP_LAST_WORDS = new Set([
  "State", "Tech", "A&M", "International", "Southern", "Northern", "Eastern", "Western", "Central", "Atlantic", "Pacific", "Carolina", "Florida", "Georgia", "Texas", "Washington", "Mississippi", "Arizona", "Alabama", "Louisiana", "California", "Colorado", "Dakota", "Mexico", "England", "Orleans", "Monroe", "Lafayette", "Vegas", "Jose", "Diego", "Angeles", "Louis", "Francisco", "Forest", "Green", "Bowling", "Army", "Navy", "Air", "Force", "Notre", "Dame", "Ole", "Miss", "BYU", "TCU", "UAB", "UTEP", "UTSA", "UCF", "USF", "UCLA", "USC", "SMU", "UNLV", "UNM", "LSU", "NC", "Appalachian", "Liberty", "Temple", "Rice", "Duke", "Tulane", "Rutgers", "Purdue", "Stanford", "Syracuse", "Clemson", "Auburn", "Memphis", "Hawaii", "Valley", "Bluff"
]);

const COLLEGE_MANUAL_DISPLAY: Record<string, string> = {
  "north carolina tar heels": "North Carolina",
  "unc tar heels": "North Carolina",
  "north carolina": "North Carolina",
  "stanford cardinal": "Stanford",
  "san jose state spartans": "San Jose State",
  "sjsu": "San Jose State",
  "hawaii rainbow warriors": "Hawaii",
  "hawaii": "Hawaii",
  "appalachian state mountaineers": "Appalachian State",
  "app state mountaineers": "App State",
  "app state": "App State",
  "miami hurricanes": "Miami",
  "miami fl hurricanes": "Miami",
  "miami florida hurricanes": "Miami",
  "miami ohio redhawks": "Miami Ohio",
  "miami oh redhawks": "Miami Ohio",
  "nc state wolfpack": "NC State",
  "n c state wolfpack": "NC State",
  "ole miss rebels": "Ole Miss",
  "southern miss golden eagles": "Southern Miss",
  "western kentucky hilltoppers": "Western Kentucky",
  "middle tennessee blue raiders": "Middle Tennessee",
  "bowling green falcons": "Bowling Green",
  "florida international panthers": "FIU",
  "fiu panthers": "FIU",
  "florida atlantic owls": "Florida Atlantic",
  "fau owls": "FAU",
  "sam houston bearkats": "Sam Houston",
  "sam houston state bearkats": "Sam Houston",
  "louisiana ragin cajuns": "Louisiana",
  "louisiana monroe warhawks": "Louisiana Monroe",
  "ul monroe warhawks": "Louisiana Monroe",
  "umass minutemen": "UMass",
  "massachusetts minutemen": "UMass",
  "ut rio grande valley vaqueros": "UT Rio Grande Valley",
  "arkansas pine bluff golden lions": "Arkansas Pine-Bluff",
  "arkansas pine bluff": "Arkansas Pine-Bluff",
  "mercyhurst lakers": "Mercyhurst",
  "syracuse orange": "Syracuse",
  "utep miners": "UTEP",
  "utsa roadrunners": "UTSA",
  "uconn huskies": "UConn",
  "connecticut huskies": "UConn",
  "byu cougars": "BYU",
  "tcu horned frogs": "TCU",
  "ucf knights": "UCF",
  "usf bulls": "USF",
  "uab blazers": "UAB",
  "unlv rebels": "UNLV",
  "smu mustangs": "SMU",
  "lsu tigers": "LSU",
  "ucla bruins": "UCLA",
  "usc trojans": "USC"
};

const TEAM_ABBREVIATIONS: Record<string, string> = {
  "north dakota state": "NDSU",
  "south dakota state": "SDSU",
  "sacramento state": "Sac St.",
  "eastern michigan": "EMU",
  "western michigan": "WMU",
  "central michigan": "CMU",
  "north carolina state": "NCSU",
  "appalachian state": "App St.",
  "arkansas pine bluff": "UAPB",
  "ut rio grande valley": "UTRGV",
  "louisiana monroe": "ULM",
  "middle tennessee": "MTSU",
  "western kentucky": "WKU",
  "northern illinois": "NIU",
  "southern illinois": "SIU",
  "bowling green": "BGSU",
  "florida international": "FIU",
  "florida atlantic": "FAU"
};

const displayNameCache = new Map<string, string>();

export function normalizeTeamNameKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/hawai[\s'’`-]*i/g, "hawaii")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const COLLEGE_SUFFIX_MATCHES = COLLEGE_NICKNAME_SUFFIXES.map((suffix) => ({
  suffix,
  key: normalizeTeamNameKey(suffix)
}));

function collegeDisplayStyle(name: string) {
  return name.replace(/\bState\b/g, "St.");
}

function collegeSchoolName(rawTeam: string) {
  const manual = COLLEGE_MANUAL_DISPLAY[normalizeTeamNameKey(rawTeam)];
  if (manual) return collegeDisplayStyle(manual);

  let cleaned = rawTeam
    .replace(/\bUniversity of\b/gi, "")
    .replace(/\bCollege\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  let changed = true;
  while (changed) {
    changed = false;
    const cleanedKey = normalizeTeamNameKey(cleaned);
    for (const suffix of COLLEGE_SUFFIX_MATCHES) {
      if (cleanedKey.endsWith(` ${suffix.key}`)) {
        cleaned = cleaned.slice(0, Math.max(0, cleaned.length - suffix.suffix.length)).trim();
        changed = true;
        break;
      }
    }
  }

  const manualAfterStrip = COLLEGE_MANUAL_DISPLAY[normalizeTeamNameKey(cleaned)];
  if (manualAfterStrip) return collegeDisplayStyle(manualAfterStrip);

  const parts = cleaned.split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1];
  const lastTwoKey = normalizeTeamNameKey(parts.slice(-2).join(" "));
  if (parts.length >= 3 && ["tar heels", "fighting irish", "red raiders", "blue devils", "golden bears", "green wave", "crimson tide"].includes(lastTwoKey)) {
    cleaned = parts.slice(0, -2).join(" ");
  } else if (parts.length >= 3 && last && !COLLEGE_KEEP_LAST_WORDS.has(last)) {
    cleaned = parts.slice(0, -1).join(" ");
  }

  return collegeDisplayStyle(cleaned || rawTeam);
}

export function teamDisplayName(league: string | null | undefined, team: string) {
  const cacheKey = `${league || "CFB"}:${team}`;
  const cached = displayNameCache.get(cacheKey);
  if (cached) return cached;

  const displayName = league === "NFL"
    ? NFL_NICKNAMES.find((nickname) => team.toLowerCase().endsWith(nickname.toLowerCase())) || team.split(/\s+/).slice(-1)[0] || team
    : collegeSchoolName(team);
  displayNameCache.set(cacheKey, displayName);
  return displayName;
}

function teamAbbreviationKey(value: string) {
  return normalizeTeamNameKey(value).replace(/\bst\b/g, "state");
}

export function teamAbbreviatedName(league: string | null | undefined, team: string) {
  const fullName = teamDisplayName(league, team);
  const manual = TEAM_ABBREVIATIONS[teamAbbreviationKey(fullName)] || TEAM_ABBREVIATIONS[normalizeTeamNameKey(team)];
  if (manual) return manual;
  if (fullName.length <= 8 || /^[A-Z0-9]+$/.test(fullName)) return fullName;

  const words = fullName.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const initials = words.map((word) => /^[A-Z0-9]{2,4}$/.test(word) ? word : word[0].toUpperCase()).join("");
  const abbreviation = /\bSt\.$/i.test(fullName) && !initials.endsWith("U") ? `${initials}U` : initials;
  return abbreviation.length >= 2 && abbreviation.length <= 7 ? abbreviation : fullName;
}
