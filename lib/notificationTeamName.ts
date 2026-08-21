const NFL_NICKNAMES = [
  "49ers", "Bears", "Bengals", "Bills", "Broncos", "Browns", "Buccaneers", "Cardinals", "Chargers", "Chiefs", "Colts", "Commanders", "Cowboys", "Dolphins", "Eagles", "Falcons", "Giants", "Jaguars", "Jets", "Lions", "Packers", "Panthers", "Patriots", "Raiders", "Rams", "Ravens", "Saints", "Seahawks", "Steelers", "Texans", "Titans", "Vikings"
];

const MANUAL: Record<string, string> = {
  "north carolina tar heels": "North Carolina",
  "unc tar heels": "North Carolina",
  "nc state wolfpack": "NC State",
  "ole miss rebels": "Ole Miss",
  "southern miss golden eagles": "Southern Miss",
  "appalachian state mountaineers": "Appalachian State",
  "app state mountaineers": "App State",
  "florida international panthers": "FIU",
  "fiu panthers": "FIU",
  "sam houston bearkats": "Sam Houston",
  "sam houston state bearkats": "Sam Houston",
  "louisiana ragin cajuns": "Louisiana",
  "umass minutemen": "UMass",
  "massachusetts minutemen": "UMass",
  "uconn huskies": "UConn",
  "connecticut huskies": "UConn",
  "usc trojans": "USC",
  "ucla bruins": "UCLA",
  "lsu tigers": "LSU",
  "smu mustangs": "SMU",
  "tcu horned frogs": "TCU",
  "byu cougars": "BYU",
  "ucf knights": "UCF",
  "usf bulls": "USF",
  "uab blazers": "UAB",
  "utep miners": "UTEP",
  "utsa roadrunners": "UTSA",
  "unlv rebels": "UNLV"
};

const SUFFIXES = [
  "Rainbow Warriors", "Blue Raiders", "Blue Devils", "Green Wave", "Red Wolves", "Red Raiders", "Black Knights", "Golden Hurricane", "Golden Flashes", "Golden Gophers", "Golden Bears", "Golden Eagles", "Ragin' Cajuns", "Ragin Cajuns", "Thundering Herd", "Fighting Irish", "Fighting Illini", "Midshipmen", "Gamecocks", "Mountaineers", "Commodores", "Scarlet Knights", "Yellow Jackets", "Boilermakers", "Nittany Lions", "Tar Heels", "Sun Devils", "Demon Deacons", "Crimson Tide", "Horned Frogs", "Chanticleers", "Roadrunners", "Longhorns", "Sooners", "Cyclones", "Buffaloes", "Hurricanes", "Seminoles", "Volunteers", "Razorbacks", "Wolf Pack", "Wolfpack", "Jayhawks", "Buckeyes", "Wolverines", "Badgers", "Hawkeyes", "Hoosiers", "Terrapins", "Cornhuskers", "Flames", "Monarchs", "Miners", "Blazers", "Lobos", "Aztecs", "Bulls", "Bobcats", "Rockets", "Chippewas", "Aggies", "Spartans", "Trojans", "Knights", "Warriors", "Raiders", "Rebels", "Mustangs", "Owls", "Cougars", "Huskies", "Bearcats", "Bearkats", "Cowboys", "Utes", "Ducks", "Beavers", "Hokies", "Cavaliers", "Gators", "Bulldogs", "Eagles", "Hawks", "Falcons", "Bears", "Bruins", "Rams", "Tigers", "Wildcats", "Panthers", "Lions", "Cardinals", "Pirates"
].sort((a, b) => b.length - a.length);

function key(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function notificationTeamName(team: string, league?: string | null) {
  const manual = MANUAL[key(team)];
  if (manual) return manual;

  if (league === "NFL") {
    return NFL_NICKNAMES.find((nickname) => team.toLowerCase().endsWith(nickname.toLowerCase())) || team;
  }

  for (const suffix of SUFFIXES) {
    if (team.toLowerCase().endsWith(` ${suffix.toLowerCase()}`)) {
      return team.slice(0, -(suffix.length + 1)).trim();
    }
  }
  return team;
}
