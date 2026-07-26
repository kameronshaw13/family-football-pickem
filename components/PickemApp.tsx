"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronRight, CircleCheckBig, CircleDollarSign, EyeOff, FlaskConical, Landmark, LoaderCircle, Lock, Save, Send, Shield, Trash2, Trophy, WalletCards, X, Zap } from "lucide-react";
import type { BankEntry, BankSettings, Game, Pick, PickType, Profile, SideBet, Standing, WeekRule } from "@/lib/types";
import { MAX_ACCEPTED_SIDE_BETS_PER_WEEK, MAX_SIDE_BET_AMOUNT } from "@/lib/sideBetLimits";
import { gradeAgainstSpread, gradeUnderdogOutright, normalizeSpreadForSelectedTeam, spreadText, underdogWinValue } from "@/lib/spreads";
import { countRegularByLeague, getWeekRule } from "@/lib/weekRules";
import { computeWeeklySettlement, computeWeeklyStandings } from "@/lib/weeklyBank";
import { hasChargers, isChargersTeam } from "@/lib/seasonRules";

type Tab = "picks" | "card" | "standings" | "rules";
type PicksView = "board" | "sideBets";
type CardView = "mine" | "group";
type StandingsView = "standings" | "bank";
type BetView = "new" | "received" | "sent";
type GameStatusFilter = "OPEN" | "LOCKED" | "FINAL";
type LeagueFilter = "CFB" | "NFL" | "DOGS";
type GameOutcome = "win" | "loss" | "push";
type Toast = { message: string; tone: "success" | "error" | "info" } | null;
type LiveScoreUpdate = {
  id: string;
  live_home_score?: number | null;
  live_away_score?: number | null;
  live_status?: string | null;
  live_state?: string | null;
  live_completed?: boolean;
  live_possession_team?: string | null;
  live_situation?: string | null;
};
type TestPickRow = {
  id: string;
  gameId: string;
  team: string;
  spread: number;
  matchup: string;
  finalScore: string;
  result: "win" | "loss" | "push";
  dogValue?: number;
};

type AppData = {
  currentUser: Profile;
  profiles: Profile[];
  games: Game[];
  picks: Pick[];
  standings: Standing[];
  weeklyStandingsByWeek: Record<string, Standing[]>;
  bankSettings: BankSettings;
  bankEntries: BankEntry[];
  sideBets: SideBet[];
  sideBetAcceptedCounts: Record<string, number>;
  sideBetBankTotals: Record<string, number>;
  week: number;
  weekRule: WeekRule;
  weekOpenTime: string | null;
  availableWeeks: number[];
};
type BankWeekData = {
  week: number;
  games: Game[];
  picks: Pick[];
  weeklyStandingsByWeek?: Record<string, Standing[]>;
};

const NFL_NICKNAMES = [
  "49ers", "Bears", "Bengals", "Bills", "Broncos", "Browns", "Buccaneers", "Cardinals", "Chargers", "Chiefs", "Colts", "Commanders", "Cowboys", "Dolphins", "Eagles", "Falcons", "Giants", "Jaguars", "Jets", "Lions", "Packers", "Panthers", "Patriots", "Raiders", "Rams", "Ravens", "Saints", "Seahawks", "Steelers", "Texans", "Titans", "Vikings"
];

// These are mascot/nickname suffixes that should not show for college teams.
// The app keeps the school/location name only: "Ohio State Buckeyes" -> "Ohio State".
const COLLEGE_NICKNAME_SUFFIXES = [
  "Rainbow Warriors", "Rainbow Wahine", "Blue Raiders", "Blue Hens", "Blue Hose", "Blue Devils", "Bluejays", "Green Wave", "Mean Green", "Red Wolves", "Red Raiders", "RedHawks", "Redhawks", "Black Knights", "Golden Hurricane", "Golden Flashes", "Golden Gophers", "Golden Bears", "Golden Eagles", "Golden Knights", "Golden Lions", "Golden Panthers", "Golden Rams", "Golden Grizzlies", "Ragin Cajuns", "Ragin' Cajuns", "Thundering Herd", "Fighting Irish", "Fighting Illini", "Fighting Hawks", "Fighting Camels", "Fighting Blue Hens", "Midshipmen", "Gamecocks", "Mountaineers", "Commodores", "Scarlet Knights", "Yellow Jackets", "Boilermakers", "Nittany Lions", "Tar Heels", "Cardinal", "Sun Devils", "Demon Deacons", "Crimson Tide", "Horned Frogs", "Chanticleers", "Sycamores", "Governors", "Privateers", "Keydets", "Paladins", "Terriers", "Hatters", "Musketeers", "Ramblers", "Explorers", "Billikens", "Jackrabbits", "Leathernecks", "Roadrunners", "Lumberjacks", "Longhorns", "Sooners", "Cyclones", "Buffaloes", "Hurricanes", "Seminoles", "Volunteers", "Razorbacks", "Wolf Pack", "Wolfpack", "Jayhawks", "Buckeyes", "Wolverines", "Badgers", "Hawkeyes", "Hoosiers", "Terrapins", "Cornhuskers", "Flames", "Monarchs", "Miners", "Blazers", "Lobos", "Aztecs", "Bulls", "Zips", "Bobcats", "Rockets", "Chippewas", "Gaels", "Mocs", "Lancers", "Camels", "Seawolves", "Highlanders", "Retrievers", "Pioneers", "Broncs", "Jaspers", "Peacocks", "Salukis", "Flyers", "Penguins", "Vandals", "Mavericks", "Phoenix", "Bison", "Bisons", "Catamounts", "Minutemen", "Jaguars", "Coyotes", "Panthers", "Lions", "Tigers", "Wildcats", "Bulldogs", "Eagles", "Hawks", "Falcons", "Bears", "Bruins", "Rams", "Aggies", "Spartans", "Trojans", "Cardinals", "Pirates", "Knights", "Warriors", "Raiders", "Rebels", "Mustangs", "Owls", "Cougars", "Huskies", "Bearcats", "Bearkats", "Cowboys", "Cowgirls", "Utes", "Ducks", "Beavers", "Hokies", "Cavaliers", "Gators", "Gauchos", "Anteaters", "Matadors", "Titans", "Tritons", "Lopes", "Antelopes", "Vaqueros", "Vaqueras", "Lumberjills", "Colonels", "Racers", "Norfolk", "Dukes", "Dukes", "Dragons", "Quakers", "Big Red", "Crimson", "Bantams", "Engineers", "Statesmen", "Dutchmen", "Saints", "Saint Mary's", "Friars", "Friars", "Friars", "Vikings", "Ospreys", "Eagles", "Skyhawks", "Bucs", "Buccaneers", "Mocs", "Golden Eagles", "Hilltoppers", "Hilltoppers", "Hillcats", "Lions", "Lancers", "Patriots", "Minutewomen", "Greyhounds", "Greyhounds", "Mules", "Gorillas", "Grit", "Reivers", "Tars", "Royals"
].sort((a, b) => b.length - a.length);

const COLLEGE_KEEP_LAST_WORDS = new Set([
  "State", "Tech", "A&M", "International", "Southern", "Northern", "Eastern", "Western", "Central", "Atlantic", "Pacific", "Carolina", "Florida", "Georgia", "Texas", "Washington", "Mississippi", "Arizona", "Alabama", "Louisiana", "California", "Colorado", "Dakota", "Mexico", "England", "Orleans", "Monroe", "Lafayette", "Vegas", "Jose", "Diego", "Angeles", "Louis", "Francisco", "Forest", "Green", "Bowling", "Army", "Navy", "Air", "Force", "Notre", "Dame", "Ole", "Miss", "BYU", "TCU", "UAB", "UTEP", "UTSA", "UCF", "USF", "UCLA", "USC", "SMU", "UNLV", "UNM", "LSU", "NC", "Appalachian", "Liberty", "Temple", "Rice", "Duke", "Tulane", "Rutgers", "Purdue", "Stanford", "Syracuse", "Clemson", "Auburn", "Memphis", "Hawaii"
]);

const COLLEGE_MANUAL_DISPLAY: Record<string, string> = {
  "north carolina tar heels": "North Carolina",
  "unc tar heels": "North Carolina",
  "north carolina": "North Carolina",
  "stanford cardinal": "Stanford",
  "stanford": "Stanford",
  "san jose state spartans": "San Jose State",
  "san jose state": "San Jose State",
  "sjsu": "San Jose State",
  "hawaii rainbow warriors": "Hawaii",
  "hawai'i rainbow warriors": "Hawaii",
  "hawaii": "Hawaii",
  "hawai'i": "Hawaii",
  "appalachian state mountaineers": "Appalachian State",
  "app state mountaineers": "App State",
  "app state": "App State",
  "miami hurricanes": "Miami",
  "miami fl hurricanes": "Miami",
  "miami florida hurricanes": "Miami",
  "miami ohio redhawks": "Miami Ohio",
  "miami (oh) redhawks": "Miami Ohio",
  "nc state wolfpack": "NC State",
  "n.c. state wolfpack": "NC State",
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
  "louisiana ragin' cajuns": "Louisiana",
  "louisiana monroe warhawks": "Louisiana Monroe",
  "ul monroe warhawks": "Louisiana Monroe",
  "umass minutemen": "UMass",
  "massachusetts minutemen": "UMass",
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

function normalizeNameKey(value: string) {
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

function stripCollegeNickname(rawTeam: string) {
  const manual = COLLEGE_MANUAL_DISPLAY[normalizeNameKey(rawTeam)];
  if (manual) return manual;

  let cleaned = rawTeam
    .replace(/\bUniversity of\b/gi, "")
    .replace(/\bCollege\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  let changed = true;
  while (changed) {
    changed = false;
    const cleanedKey = normalizeNameKey(cleaned);
    for (const suffix of COLLEGE_NICKNAME_SUFFIXES) {
      const suffixKey = normalizeNameKey(suffix);
      if (cleanedKey.endsWith(` ${suffixKey}`)) {
        cleaned = cleaned.slice(0, Math.max(0, cleaned.length - suffix.length)).trim();
        changed = true;
        break;
      }
    }
  }

  const manualAfterStrip = COLLEGE_MANUAL_DISPLAY[normalizeNameKey(cleaned)];
  if (manualAfterStrip) return manualAfterStrip;

  // Safety fallback for "School Mascot" names not listed above. If the school has
  // 3+ words and the final word is not part of a school name, remove it.
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1];
  const lastTwo = parts.slice(-2).join(" ");
  const lastTwoKey = normalizeNameKey(lastTwo);
  if (parts.length >= 3 && ["tar heels", "fighting irish", "red raiders", "blue devils", "golden bears", "green wave", "crimson tide"].includes(lastTwoKey)) {
    cleaned = parts.slice(0, -2).join(" ");
  } else if (parts.length >= 3 && last && !COLLEGE_KEEP_LAST_WORDS.has(last)) {
    cleaned = parts.slice(0, -1).join(" ");
  }

  return cleaned || rawTeam;
}

function displayTeamName(game: Game, team: string) {
  if (game.league === "NFL") {
    const match = NFL_NICKNAMES.find((nickname) => team.toLowerCase().endsWith(nickname.toLowerCase()));
    return match || team.split(/\s+/).slice(-1)[0] || team;
  }
  return stripCollegeNickname(team);
}

function dogLineText(game: Game, team: string) {
  const spread = normalizeSpreadForSelectedTeam(team, game.current_spread_team, game.current_spread);
  const value = underdogWinValue(spread);
  return `${spreadText(spread)} = +${value}W`;
}

function weekdayAbbreviation(iso: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Chicago" }).format(new Date(iso)).slice(0, 3).toUpperCase();
}
function dt(iso: string) {
  return `${weekdayAbbreviation(iso)} ${timeText(iso)}`;
}
function closeText(iso: string) {
  return dt(iso);
}
function openText(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago"
  }).format(new Date(iso));
}
function cardLockText(iso: string) {
  return closeText(iso).replace(",", "");
}
function cardGameStateText(game: Game, locked: boolean) {
  if (game.final_away_score != null && game.final_home_score != null) {
    return `Final ${game.final_away_score}-${game.final_home_score}`;
  }
  if ((game.live_completed || game.live_state === "post") && game.live_away_score != null && game.live_home_score != null) {
    return `Final ${game.live_away_score}-${game.live_home_score}`;
  }
  if (locked) {
    if (new Date(game.commence_time) > new Date()) return `Starts ${dt(game.commence_time)}`;
    if (game.live_state === "in" && game.live_away_score != null && game.live_home_score != null) {
      return `${game.live_away_score}-${game.live_home_score} · ${liveGameStatus(game)}`;
    }
    if (game.live_status) return liveGameStatus(game);
    return "Score updating";
  }
  return `locks ${cardLockText(game.lock_time)}`;
}
function timeText(iso: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }).format(new Date(iso));
}
function gameDayKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Chicago" }).format(new Date(iso));
}
function gameDayLabel(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "America/Chicago" }).format(new Date(iso)).toUpperCase();
}
function gameDayShort(iso: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "America/Chicago" }).format(new Date(iso)).toUpperCase();
}
function lockText(iso: string) {
  return `${weekdayAbbreviation(iso)} ${timeText(iso)}`;
}
function spreadForTeam(game: Game, team: string) {
  return spreadText(normalizeSpreadForSelectedTeam(team, game.current_spread_team, game.current_spread));
}
function isClosed(game: Game) {
  return game.is_locked || new Date(game.lock_time) <= new Date();
}
function isFinalGame(game: Game) {
  return (game.final_away_score != null && game.final_home_score != null) || Boolean(game.live_completed) || game.live_state === "post";
}
function boardStatusForGame(game: Game, now: number, weekIsOpen: boolean): GameStatusFilter {
  if (isFinalGame(game)) return "FINAL";
  const locked = game.is_locked || new Date(game.lock_time).getTime() <= now;
  return locked || !weekIsOpen || new Date(game.commence_time).getTime() <= now ? "LOCKED" : "OPEN";
}
function defaultBoardStatus(games: Game[], now: number, weekIsOpen: boolean): GameStatusFilter {
  const statuses: GameStatusFilter[] = ["OPEN", "LOCKED", "FINAL"];
  return statuses.find((status) => games.some((game) => !hasChargers(game) && boardStatusForGame(game, now, weekIsOpen) === status)) || "OPEN";
}
function liveGameStatus(game: Game) {
  const detail = game.live_status?.trim() || "";
  const situation = game.live_situation?.trim() || "";
  const quarter = detail.match(/\b(1st|2nd|3rd|4th)\b/i)?.[1];
  const clock = detail.match(/\b\d{1,2}:\d{2}\b/)?.[0];
  let status = detail || "Score updating";

  if (/\bhalftime\b/i.test(detail)) {
    status = "Halftime";
  } else if (/\bOT\b/i.test(detail)) {
    status = clock ? `OT · ${clock}` : "OT";
  } else if (quarter && clock) {
    status = `${quarter} Qtr · ${clock}`;
  } else if (quarter) {
    status = `${quarter} Qtr`;
  } else if (clock) {
    status = clock;
  }

  return situation && status !== "Halftime" ? `${status} · ${situation}` : status;
}
function teamDogValue(game: Game, team: string) {
  return underdogWinValue(normalizeSpreadForSelectedTeam(team, game.current_spread_team, game.current_spread));
}
function logoForTeam(game: Game, team: string) {
  return team === game.home_team ? game.home_logo_url : game.away_logo_url;
}
function money(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  return `${sign}$${absolute.toFixed(Number.isInteger(absolute) ? 0 : 2)}`;
}
function stakeMoney(value: number) {
  return `$${Math.abs(Number(value)).toFixed(Number.isInteger(Number(value)) ? 0 : 2)}`;
}
function sideBetAmountForUser(bet: SideBet, userId: string) {
  const stake = Number(bet.amount);
  if (bet.status !== "settled") return { text: stakeMoney(stake), tone: "" };
  if (bet.result === "push") return { text: "$0", tone: "" };

  const involved = bet.creator_id === userId || bet.accepted_by === userId;
  if (!involved) return { text: stakeMoney(stake), tone: "" };

  const won = bet.winner_id === userId ||
    (!bet.winner_id && bet.result === "creator_win" && bet.creator_id === userId) ||
    (!bet.winner_id && bet.result === "acceptor_win" && bet.accepted_by === userId);
  return {
    text: money(won ? stake : -stake),
    tone: won ? "money-pos" : "money-neg"
  };
}
function pctText(value: number) {
  return Number(value || 0).toFixed(3).replace(/^0/, "");
}

function completeSeasonStandings(profiles: Profile[], rows: Standing[]) {
  const byUser = new Map(rows.map((row) => [row.user_id, row]));
  const complete = profiles.map((profile) => byUser.get(profile.id) || {
    user_id: profile.id,
    display_name: profile.display_name,
    wins: 0,
    losses: 0,
    pushes: 0,
    win_pct: 0
  });

  return complete.sort((a, b) =>
    (Number(b.win_pct) - Number(a.win_pct)) ||
    (Number(b.wins) - Number(a.wins)) ||
    (Number(a.losses) - Number(b.losses)) ||
    a.display_name.localeCompare(b.display_name)
  );
}

function buildTestWeek(profiles: Profile[]) {
  const previewNow = Date.now();
  const previewTime = (minutesFromNow: number) => new Date(previewNow + minutesFromNow * 60_000).toISOString();
  const games: Game[] = [
    {
      id: "test-virginia-nc-state", week: 3, league: "CFB", commence_time: previewTime(240),
      away_team: "Virginia Cavaliers", home_team: "NC State Wolfpack",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/258.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/152.png",
      current_spread_team: "NC State Wolfpack", current_spread: -10.5, current_bookmaker: "Test line",
      lock_time: previewTime(-120), is_locked: true, final_away_score: null, final_home_score: null,
      live_away_score: null, live_home_score: null, live_status: null, live_state: "pre", live_completed: false
    },
    {
      id: "test-raiders-broncos", week: 3, league: "NFL", commence_time: previewTime(360),
      away_team: "Las Vegas Raiders", home_team: "Denver Broncos",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/nfl/500/13.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/nfl/500/7.png",
      current_spread_team: "Denver Broncos", current_spread: -7.5, current_bookmaker: "Test line",
      lock_time: previewTime(-120), is_locked: true, final_away_score: null, final_home_score: null,
      live_away_score: null, live_home_score: null, live_status: null, live_state: "pre", live_completed: false
    },
    {
      id: "test-sjsu-fresno", week: 3, league: "CFB", commence_time: previewTime(-50),
      away_team: "San Jose State Spartans", home_team: "Fresno State Bulldogs",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/23.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/278.png",
      current_spread_team: "Fresno State Bulldogs", current_spread: -10.5, current_bookmaker: "Test line",
      lock_time: previewTime(-180), is_locked: true, final_away_score: null, final_home_score: null,
      live_away_score: 13, live_home_score: 17, live_status: "3rd 8:42", live_state: "in", live_completed: false,
      live_possession_team: "Fresno State Bulldogs", live_situation: "2nd & 7 at SJSU 42"
    },
    {
      id: "test-giants-eagles", week: 3, league: "NFL", commence_time: previewTime(-80),
      away_team: "New York Giants", home_team: "Philadelphia Eagles",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/nfl/500/19.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/nfl/500/21.png",
      current_spread_team: "Philadelphia Eagles", current_spread: -8.5, current_bookmaker: "Test line",
      lock_time: previewTime(-180), is_locked: true, final_away_score: null, final_home_score: null,
      live_away_score: 10, live_home_score: 17, live_status: "3rd 5:16", live_state: "in", live_completed: false,
      live_possession_team: "New York Giants", live_situation: "3rd & 4 at PHI 36"
    },
    {
      id: "test-iowa-rutgers", week: 3, league: "CFB", commence_time: "2026-09-12T00:00:00.000Z",
      away_team: "Rutgers Scarlet Knights", home_team: "Iowa Hawkeyes",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/164.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/2294.png",
      current_spread_team: "Iowa Hawkeyes", current_spread: -7.5, current_bookmaker: "Test line",
      lock_time: "2026-09-11T00:00:00.000Z", is_locked: true, final_away_score: 17, final_home_score: 27
    },
    {
      id: "test-unc-tcu", week: 3, league: "CFB", commence_time: "2026-09-12T16:00:00.000Z",
      away_team: "North Carolina Tar Heels", home_team: "TCU Horned Frogs",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/153.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/2628.png",
      current_spread_team: "TCU Horned Frogs", current_spread: -6.5, current_bookmaker: "Test line",
      lock_time: "2026-09-11T23:00:00.000Z", is_locked: true, final_away_score: 24, final_home_score: 27
    },
    {
      id: "test-cowboys-chiefs", week: 3, league: "NFL", commence_time: "2026-09-13T17:00:00.000Z",
      away_team: "Dallas Cowboys", home_team: "Kansas City Chiefs",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/nfl/500/6.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/nfl/500/12.png",
      current_spread_team: "Kansas City Chiefs", current_spread: -3, current_bookmaker: "Test line",
      lock_time: "2026-09-11T23:00:00.000Z", is_locked: true, final_away_score: 24, final_home_score: 29
    },
    {
      id: "test-texas-ohio-state", week: 3, league: "CFB", commence_time: "2026-09-13T19:30:00.000Z",
      away_team: "Texas Longhorns", home_team: "Ohio State Buckeyes",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/251.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/194.png",
      current_spread_team: "Ohio State Buckeyes", current_spread: -10.5, current_bookmaker: "Test line",
      lock_time: "2026-09-11T23:00:00.000Z", is_locked: true, final_away_score: 17, final_home_score: 31
    },
    {
      id: "test-seahawks-patriots", week: 3, league: "NFL", commence_time: "2026-09-14T00:20:00.000Z",
      away_team: "Seattle Seahawks", home_team: "New England Patriots",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/nfl/500/26.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/nfl/500/17.png",
      current_spread_team: "New England Patriots", current_spread: -2.5, current_bookmaker: "Test line",
      lock_time: "2026-09-11T23:00:00.000Z", is_locked: true, final_away_score: 20, final_home_score: 23
    },
    {
      id: "test-stanford-usc", week: 3, league: "CFB", commence_time: "2026-09-13T03:00:00.000Z",
      away_team: "Stanford Cardinal", home_team: "USC Trojans",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/24.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/30.png",
      current_spread_team: "USC Trojans", current_spread: -10.5, current_bookmaker: "Test line",
      lock_time: "2026-09-11T23:00:00.000Z", is_locked: true, final_away_score: 24, final_home_score: 21
    },
    {
      id: "test-hawaii-oregon", week: 3, league: "CFB", commence_time: "2026-09-13T22:00:00.000Z",
      away_team: "Hawaii Rainbow Warriors", home_team: "Oregon Ducks",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/62.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png",
      current_spread_team: "Oregon Ducks", current_spread: -20.5, current_bookmaker: "Test line",
      lock_time: "2026-09-11T23:00:00.000Z", is_locked: true, final_away_score: 14, final_home_score: 38
    },
    {
      id: "test-ucla-oregon", week: 3, league: "CFB", commence_time: "2026-09-14T02:00:00.000Z",
      away_team: "UCLA Bruins", home_team: "Oregon Ducks",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/26.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png",
      current_spread_team: "Oregon Ducks", current_spread: -7, current_bookmaker: "Test line",
      lock_time: "2026-09-11T23:00:00.000Z", is_locked: true, final_away_score: 21, final_home_score: 28
    }
  ];

  const cards: TestPickRow[][] = [
    [
      { id: "iowa", gameId: "test-iowa-rutgers", team: "Iowa Hawkeyes", spread: -7.5, matchup: "Rutgers at Iowa", finalScore: "17-27", result: "win" },
      { id: "unc", gameId: "test-unc-tcu", team: "North Carolina Tar Heels", spread: 6.5, matchup: "North Carolina at TCU", finalScore: "24-27", result: "win" },
      { id: "chiefs", gameId: "test-cowboys-chiefs", team: "Kansas City Chiefs", spread: -3, matchup: "Cowboys at Chiefs", finalScore: "24-29", result: "win" },
      { id: "ohio-state", gameId: "test-texas-ohio-state", team: "Ohio State Buckeyes", spread: -10.5, matchup: "Texas at Ohio State", finalScore: "17-31", result: "win" },
      { id: "patriots", gameId: "test-seahawks-patriots", team: "New England Patriots", spread: -2.5, matchup: "Seahawks at Patriots", finalScore: "20-23", result: "win" },
      { id: "stanford-dog", gameId: "test-stanford-usc", team: "Stanford Cardinal", spread: 10.5, matchup: "Stanford at USC", finalScore: "24-21", result: "win", dogValue: 2 }
    ],
    [
      { id: "iowa", gameId: "test-iowa-rutgers", team: "Iowa Hawkeyes", spread: -7.5, matchup: "Rutgers at Iowa", finalScore: "17-27", result: "win" },
      { id: "unc", gameId: "test-unc-tcu", team: "North Carolina Tar Heels", spread: 6.5, matchup: "North Carolina at TCU", finalScore: "24-27", result: "win" },
      { id: "chiefs", gameId: "test-cowboys-chiefs", team: "Kansas City Chiefs", spread: -3, matchup: "Cowboys at Chiefs", finalScore: "24-29", result: "win" },
      { id: "ohio-state", gameId: "test-texas-ohio-state", team: "Ohio State Buckeyes", spread: -10.5, matchup: "Texas at Ohio State", finalScore: "17-31", result: "win" },
      { id: "patriots", gameId: "test-seahawks-patriots", team: "New England Patriots", spread: -2.5, matchup: "Seahawks at Patriots", finalScore: "20-23", result: "win" },
      { id: "hawaii-dog", gameId: "test-hawaii-oregon", team: "Hawaii Rainbow Warriors", spread: 20.5, matchup: "Hawaii at Oregon", finalScore: "14-38", result: "loss", dogValue: 3 }
    ],
    [
      { id: "iowa", gameId: "test-iowa-rutgers", team: "Iowa Hawkeyes", spread: -7.5, matchup: "Rutgers at Iowa", finalScore: "17-27", result: "win" },
      { id: "tcu", gameId: "test-unc-tcu", team: "TCU Horned Frogs", spread: -6.5, matchup: "North Carolina at TCU", finalScore: "24-27", result: "loss" },
      { id: "cowboys", gameId: "test-cowboys-chiefs", team: "Dallas Cowboys", spread: 3, matchup: "Cowboys at Chiefs", finalScore: "24-29", result: "loss" },
      { id: "ohio-state", gameId: "test-texas-ohio-state", team: "Ohio State Buckeyes", spread: -10.5, matchup: "Texas at Ohio State", finalScore: "17-31", result: "win" },
      { id: "ucla", gameId: "test-ucla-oregon", team: "UCLA Bruins", spread: 7, matchup: "UCLA at Oregon", finalScore: "21-28", result: "push" },
      { id: "hawaii-dog", gameId: "test-hawaii-oregon", team: "Hawaii Rainbow Warriors", spread: 20.5, matchup: "Hawaii at Oregon", finalScore: "14-38", result: "loss", dogValue: 3 }
    ]
  ];

  const playerCards = profiles.slice(0, 3).map((profile, profileIndex) => {
    const rows = cards[profileIndex] || [];
    const picks = rows.map((row, pickIndex): Pick => ({
      id: `test-${profile.id}-${pickIndex}`,
      user_id: profile.id,
      game_id: row.gameId,
      week: 3,
      selected_team: row.team,
      pick_type: row.dogValue ? "underdog" : "regular",
      status: "locked",
      locked_spread: row.spread,
      locked_spread_team: row.team,
      locked_at: "2026-09-11T00:00:00.000Z",
      underdog_win_value: row.dogValue || null,
      result: row.result,
      game: games.find((game) => game.id === row.gameId)
    }));
    return { profile, rows, picks };
  });

  const picks = playerCards.flatMap((card) => card.picks);
  const standings = computeWeeklyStandings(profiles, picks);
  const settlement = computeWeeklySettlement(standings, true);
  const bankEntries: BankEntry[] = standings.map((row) => ({
    id: `test-entry-${row.user_id}`,
    week: 3,
    user_id: row.user_id,
    amount: settlement.amounts.get(row.user_id) || 0,
    note: settlement.notes.get(row.user_id) || "Test week settlement",
    profile: { display_name: row.display_name }
  }));

  const sideBets: SideBet[] = profiles.length >= 2 ? [{
    id: "test-side-bet-settled",
    creator_id: profiles[0].id,
    game_id: "test-cowboys-chiefs",
    week: 3,
    creator_team: "Dallas Cowboys",
    offered_team: "Kansas City Chiefs",
    creator_spread: 6,
    offered_spread: -6,
    amount: 25,
    status: "settled",
    accepted_by: profiles[1].id,
    accepted_at: "2026-09-11T18:00:00.000Z",
    winner_id: profiles[0].id,
    result: "creator_win",
    created_at: "2026-09-11T17:30:00.000Z",
    updated_at: "2026-09-13T21:00:00.000Z",
    game: games.find((game) => game.id === "test-cowboys-chiefs"),
    creator: { id: profiles[0].id, display_name: profiles[0].display_name },
    accepted_by_profile: { id: profiles[1].id, display_name: profiles[1].display_name },
    targets: [{
      side_bet_id: "test-side-bet-settled",
      recipient_id: profiles[1].id,
      response: "accepted",
      responded_at: "2026-09-11T18:00:00.000Z",
      recipient: { id: profiles[1].id, display_name: profiles[1].display_name }
    }]
  }] : [];
  const sideBetBankTotals = Object.fromEntries(profiles.map((profile) => [profile.id, 0]));
  if (profiles.length >= 2) {
    sideBetBankTotals[profiles[0].id] = 25;
    sideBetBankTotals[profiles[1].id] = -25;
  }

  return { games, playerCards, picks, standings, settlement, bankEntries, sideBets, sideBetBankTotals };
}

export default function PickemApp() {
  const [tab, setTab] = useState<Tab>("picks");
  const [picksView, setPicksView] = useState<PicksView>("board");
  const [cardView, setCardView] = useState<CardView>("mine");
  const [standingsView, setStandingsView] = useState<StandingsView>("standings");
  const [standingsWeek, setStandingsWeek] = useState<number | null>(null);
  const [bankWeek, setBankWeek] = useState<number | null>(null);
  const [bankWeekData, setBankWeekData] = useState<BankWeekData | null>(null);
  const [bankWeekLoading, setBankWeekLoading] = useState(false);
  const [betView, setBetView] = useState<BetView>("received");
  const [statusFilter, setStatusFilter] = useState<GameStatusFilter>("OPEN");
  const [leagueFilter, setLeagueFilter] = useState<LeagueFilter>("CFB");
  const [statusFilterTouched, setStatusFilterTouched] = useState(false);
  const [data, setData] = useState<AppData | null>(null);
  const [week, setWeek] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [savingPicks, setSavingPicks] = useState(false);
  const [savingBet, setSavingBet] = useState(false);
  const [savingBetId, setSavingBetId] = useState<string | null>(null);
  const [stagedPicks, setStagedPicks] = useState<Pick[] | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [betGameId, setBetGameId] = useState("");
  const [betCreatorTeam, setBetCreatorTeam] = useState("");
  const [betAmount, setBetAmount] = useState("20");
  const [betRecipients, setBetRecipients] = useState<string[]>([]);
  const [toast, setToast] = useState<Toast>(null);
  const [testWeekActive, setTestWeekActive] = useState(false);
  const hasActiveGames = Boolean(data?.games.some((game) => {
    const start = new Date(game.commence_time).getTime();
    return game.final_home_score == null &&
      game.final_away_score == null &&
      !game.live_completed &&
      start <= clock &&
      start >= clock - 12 * 60 * 60 * 1000;
  }));

  async function load(nextWeek = week) {
    const isInitialLoad = data === null;
    if (isInitialLoad) setLoading(true);
    else setRefreshing(true);
    setMessage("");
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) {
      window.location.href = "/login";
      return;
    }
    const url = new URL("/api/app-data", window.location.origin);
    if (nextWeek != null) url.searchParams.set("week", String(nextWeek));
    const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        window.localStorage.removeItem("pickem_session_token");
        window.localStorage.removeItem("pickem_profile");
        window.location.replace("/login");
        return;
      }
      setMessage(payload.error || "Could not load app data.");
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const loadedAt = Date.now();
    const loadedWeekIsOpen = !payload.weekOpenTime || new Date(payload.weekOpenTime).getTime() <= loadedAt;
    setData(payload);
    setWeek(payload.week);
    setStatusFilter(defaultBoardStatus(payload.games || [], loadedAt, loadedWeekIsOpen));
    setStatusFilterTouched(false);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { load(null); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => {
    if (week == null) return;
    setStandingsWeek(week);
    setBankWeek(week);
    setBankWeekData(null);
  }, [week]);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!data || statusFilterTouched) return;
    const weekIsOpenNow = !data.weekOpenTime || new Date(data.weekOpenTime).getTime() <= clock;
    const hasCurrentStatus = data.games.some((game) => !hasChargers(game) && boardStatusForGame(game, clock, weekIsOpenNow) === statusFilter);
    if (!hasCurrentStatus) setStatusFilter(defaultBoardStatus(data.games, clock, weekIsOpenNow));
  }, [clock, data, statusFilter, statusFilterTouched]);
  useEffect(() => {
    if (week == null || !hasActiveGames) return;
    let cancelled = false;

    async function refreshLiveScores() {
      if (document.visibilityState === "hidden") return;
      const token = window.localStorage.getItem("pickem_session_token");
      if (!token) return;
      try {
        const response = await fetch(`/api/live-scores?week=${week}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store"
        });
        if (!response.ok) return;
        const payload = await response.json() as { games?: LiveScoreUpdate[] };
        if (cancelled || !payload.games?.length) return;
        const scoresById = new Map(payload.games.map((game) => [game.id, game]));
        setData((current) => current ? {
          ...current,
          games: current.games.map((game) => {
            const score = scoresById.get(game.id);
            return score ? { ...game, ...score } : game;
          })
        } : current);
      } catch {
        // Keep the last known score visible through brief network interruptions.
      }
    }

    void refreshLiveScores();
    const timer = window.setInterval(refreshLiveScores, 20_000);
    const refreshOnResume = () => void refreshLiveScores();
    window.addEventListener("focus", refreshOnResume);
    window.addEventListener("online", refreshOnResume);
    document.addEventListener("visibilitychange", refreshOnResume);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshOnResume);
      window.removeEventListener("online", refreshOnResume);
      document.removeEventListener("visibilitychange", refreshOnResume);
    };
  }, [hasActiveGames, week]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function notify(message: string, tone: NonNullable<Toast>["tone"] = "info") {
    setToast({ message, tone });
  }

  async function loadBankWeek(nextWeek: number) {
    setBankWeek(nextWeek);
    if (nextWeek === data?.week) {
      setBankWeekData(null);
      return;
    }

    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    setBankWeekLoading(true);
    try {
      const response = await fetch(`/api/bank?week=${nextWeek}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          window.localStorage.removeItem("pickem_session_token");
          window.localStorage.removeItem("pickem_profile");
          window.location.replace("/login");
          return;
        }
        notify(payload.error || "Could not load those weekly results.", "error");
        return;
      }
      setBankWeekData(payload);
    } catch {
      notify("Could not load those weekly results.", "error");
    } finally {
      setBankWeekLoading(false);
    }
  }

  async function savePicks(card: Pick[]) {
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) {
      window.location.href = "/login";
      return false;
    }
    setSavingPicks(true);
    try {
      const response = await fetch("/api/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "saveCard", week: data?.week, picks: card.map((pick) => ({ gameId: pick.game_id, selectedTeam: pick.selected_team, pickType: pick.pick_type })) })
      });
      const payload = await response.json();
      if (!response.ok) {
        notify(payload.error || "Picks could not be saved.", "error");
        return false;
      }
      setData((current) => {
        if (!current) return current;
        const savedPicks = (payload.picks || []).map((pick: Pick) => ({
          ...pick,
          game: current.games.find((game) => game.id === pick.game_id) || pick.game
        }));
        return {
          ...current,
          picks: [
            ...current.picks.filter((pick) => !(pick.user_id === current.currentUser.id && pick.week === current.week)),
            ...savedPicks
          ]
        };
      });
      setStagedPicks(null);
      notify("Picks saved. They remain editable until each game locks.", "success");
      return true;
    } catch {
      notify("Picks could not be saved.", "error");
      return false;
    } finally {
      setSavingPicks(false);
    }
  }

  async function postSideBet(body: any) {
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) {
      window.location.href = "/login";
      return false;
    }
    setSavingBet(true);
    setSavingBetId(body.sideBetId || null);
    try {
      const response = await fetch("/api/side-bets", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ ...body, viewWeek: data?.week }) });
      const payload = await response.json();
      if (!response.ok) {
        notify(payload.error || "Side bet action failed.", "error");
        return false;
      }
      if (Array.isArray(payload.sideBets)) {
        setData((current) => current ? {
          ...current,
          sideBets: payload.sideBets.map((bet: SideBet) => ({
            ...bet,
            game: current.games.find((game) => game.id === bet.game_id) || bet.game
          })),
          sideBetAcceptedCounts: payload.sideBetAcceptedCounts || current.sideBetAcceptedCounts
        } : current);
      } else {
        await load(week);
      }
      return true;
    } catch {
      notify("Side bet action failed.", "error");
      return false;
    } finally {
      setSavingBet(false);
      setSavingBetId(null);
    }
  }

  if (loading) return <LoadingShell />;
  if (!data) return <div className="app-shell"><main className="container"><div className="error-card">{message || "Could not load app."}</div></main></div>;

  const { currentUser, games, picks, profiles, standings, availableWeeks, bankEntries } = data;
  const liveSideBets = data.sideBets || [];
  const testWeek = profiles.length === 3 ? buildTestWeek(profiles) : null;
  const previewActive = Boolean(testWeekActive && testWeek);
  const sideBets = previewActive ? testWeek!.sideBets : liveSideBets;
  const viewedSideBetBankTotals = previewActive ? testWeek!.sideBetBankTotals : data.sideBetBankTotals;
  const viewedGames = previewActive ? testWeek!.games : games;
  const viewedPicks = previewActive ? testWeek!.picks : picks;
  const viewedWeek = previewActive ? 3 : data.week;
  const viewedBankEntries = previewActive ? testWeek!.bankEntries : bankEntries;
  const rule = previewActive ? getWeekRule(3) : data.weekRule || getWeekRule(data.week);
  const myPicks = viewedPicks.filter((p) => p.user_id === currentUser.id && p.week === viewedWeek);
  const cardPicks = previewActive ? myPicks : stagedPicks ?? myPicks;
  const cardIsLocked = cardPicks.length > 0 && cardPicks.every((pick) => {
    const game = viewedGames.find((item) => item.id === pick.game_id) || pick.game;
    return pick.status === "locked" || Boolean(game && isClosed(game));
  });
  const myRegular = cardPicks.filter((p) => p.pick_type === "regular");
  const myUnderdog = cardPicks.find((p) => p.pick_type === "underdog");
  const regularCounts = countRegularByLeague(cardPicks, viewedGames);
  const seasonStandings = previewActive ? testWeek!.standings : completeSeasonStandings(profiles, standings);
  const selectedStandingsWeek = standingsWeek ?? data.week;
  const weeklyStandings = previewActive
    ? testWeek!.standings
    : data.weeklyStandingsByWeek?.[String(selectedStandingsWeek)] || (selectedStandingsWeek === data.week ? computeWeeklyStandings(profiles, picks) : computeWeeklyStandings(profiles, []));
  const selectedBankWeek = bankWeek ?? data.week;
  const selectedBankData = selectedBankWeek === data.week ? data : bankWeekData?.week === selectedBankWeek ? bankWeekData : null;
  const bankResultWeek = previewActive ? 3 : selectedBankWeek;
  const bankResultGames = previewActive ? testWeek!.games : selectedBankData?.games || [];
  const bankResultPicks = previewActive ? testWeek!.picks : selectedBankData?.picks || [];
  const bankWeekStandings = previewActive
    ? testWeek!.standings
    : selectedBankData?.weeklyStandingsByWeek?.[String(bankResultWeek)] || computeWeeklyStandings(profiles, bankResultPicks);
  const bankWeekAmounts = Object.fromEntries(profiles.map((profile) => {
    const entries = viewedBankEntries.filter((entry) => entry.week === bankResultWeek && entry.user_id === profile.id);
    return [profile.id, entries.length ? entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0) : null];
  }));
  const standingsWeeks = availableWeeks.filter((availableWeek) => availableWeek <= data.week).sort((a, b) => b - a);
  const weekIsOpen = !previewActive && (!data.weekOpenTime || new Date(data.weekOpenTime) <= new Date());
  const leagueCardsHidden = viewedGames.some((game) => !isClosed(game));
  const incomingOffers = sideBets.filter((bet) => bet.creator_id !== currentUser.id && bet.targets?.some((target) => target.recipient_id === currentUser.id));
  const pendingOfferCount = incomingOffers.filter((bet) => bet.status === "open" && bet.targets?.some((target) => target.recipient_id === currentUser.id && target.response === "pending")).length;
  const bankTotals = profiles.map((profile) => ({
    id: profile.id,
    display_name: profile.display_name,
    total: viewedBankEntries.filter((entry) => entry.user_id === profile.id).reduce((sum, entry) => sum + Number(entry.amount || 0), 0) + Number(viewedSideBetBankTotals?.[profile.id] || 0)
  })).sort((a, b) => b.total - a.total);
  const openBetGames = games.filter((game) => !hasChargers(game) && new Date(game.commence_time) > new Date() && game.current_spread != null && game.current_spread_team);
  const selectedBetGame = openBetGames.find((game) => game.id === betGameId) || openBetGames[0];
  const selectedCreatorTeam = selectedBetGame && [selectedBetGame.away_team, selectedBetGame.home_team].includes(betCreatorTeam) ? betCreatorTeam : selectedBetGame?.away_team || "";

  function stageCard(nextCard: Pick[]) {
    const matchesSaved = nextCard.length === myPicks.length && nextCard.every((nextPick) => {
      const savedPick = myPicks.find((pick) => pick.game_id === nextPick.game_id);
      return savedPick?.selected_team === nextPick.selected_team && savedPick.pick_type === nextPick.pick_type;
    });
    setStagedPicks(matchesSaved ? null : nextCard);
  }

  const filteredGames = viewedGames.filter((g) => {
    if (hasChargers(g)) return false;
    if (boardStatusForGame(g, clock, weekIsOpen) !== statusFilter) return false;
    if (leagueFilter === "CFB") return g.league === "CFB";
    if (leagueFilter === "NFL") return g.league === "NFL";
    return [g.away_team, g.home_team].some((team) => !isChargersTeam(team) && teamDogValue(g, team) > 0);
  }).sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime());
  const gameGroups = filteredGames.reduce<Array<{ key: string; label: string; shortDay: string; games: Game[] }>>((groups, game) => {
    const key = gameDayKey(game.commence_time);
    const existingGroup = groups[groups.length - 1];
    if (existingGroup?.key === key) existingGroup.games.push(game);
    else groups.push({ key, label: gameDayLabel(game.commence_time), shortDay: gameDayShort(game.commence_time), games: [game] });
    return groups;
  }, []);
  function addPick(game: Game, team: string, pickType: PickType) {
    if (hasChargers(game)) {
      notify("Los Angeles Chargers games are not available in this league.", "error");
      return;
    }
    if (!game.current_spread_team || game.current_spread == null) {
      notify("This game cannot be picked until a spread is available.", "error");
      return;
    }
    const existing = cardPicks.find((pick) => pick.game_id === game.id);
    if (existing?.status === "locked") {
      if (existing.pick_type !== pickType) {
        notify(existing.pick_type === "underdog"
          ? "This game is already your dog and cannot also be a spread pick."
          : "This game is already a spread pick and cannot also be your dog.", "error");
      }
      return;
    }
    if (existing?.selected_team === team && existing.pick_type === pickType) {
      stageCard(cardPicks.filter((pick) => pick.game_id !== game.id));
      return;
    }
    if (existing && existing.pick_type !== pickType) {
      notify(existing.pick_type === "underdog"
        ? "This game is already your dog and cannot also be a spread pick."
        : "This game is already a spread pick and cannot also be your dog.", "error");
      return;
    }

    const selectedSpread = normalizeSpreadForSelectedTeam(team, game.current_spread_team, game.current_spread);
    const nextPick: Pick = existing ? {
      ...existing,
      selected_team: team,
      underdog_win_value: pickType === "underdog" ? underdogWinValue(selectedSpread) : null,
      game
    } : {
      id: `unsaved-${game.id}`,
      user_id: currentUser.id,
      game_id: game.id,
      week: game.week,
      selected_team: team,
      pick_type: pickType,
      status: "draft",
      locked_spread: null,
      locked_spread_team: null,
      locked_at: null,
      underdog_win_value: pickType === "underdog" ? underdogWinValue(selectedSpread) : null,
      result: "pending",
      game
    };
    const nextCard = existing ? cardPicks.map((pick) => pick.game_id === game.id ? nextPick : pick) : [...cardPicks, nextPick];
    const nextRegular = nextCard.filter((pick) => pick.pick_type === "regular");
    const nextDogs = nextCard.filter((pick) => pick.pick_type === "underdog");
    const counts = countRegularByLeague(nextCard, games);
    if (nextRegular.length > rule.regularTotal) return notify(`This week allows ${rule.regularTotal} regular picks.`, "error");
    if (nextDogs.length > rule.underdogTotal) return notify("Only one underdog pick is allowed.", "error");
    if (counts.cfb > rule.regularTotal - rule.nflMinimum) return notify(`This week requires ${rule.nflMinimum} NFL regular pick${rule.nflMinimum === 1 ? "" : "s"}.`, "error");
    if (counts.nfl > rule.regularTotal - rule.cfbMinimum) return notify(`This week requires ${rule.cfbMinimum} CFB regular pick${rule.cfbMinimum === 1 ? "" : "s"}.`, "error");
    stageCard(nextCard);
  }

  function removePick(pick: Pick) {
    if (pick.status === "locked") return;
    const game = viewedGames.find((item) => item.id === pick.game_id) || pick.game;
    if (game && isClosed(game)) {
      notify("This pick has reached its lock time and is final.", "error");
      return;
    }
    stageCard(cardPicks.filter((item) => item.game_id !== pick.game_id));
  }

  function toggleBetRecipient(profileId: string) {
    setBetRecipients((current) => current.includes(profileId) ? current.filter((id) => id !== profileId) : [...current, profileId]);
  }

  async function createSideBet() {
    if (!selectedBetGame || !selectedCreatorTeam || !betRecipients.length) return;
    if (Number(betAmount) > MAX_SIDE_BET_AMOUNT) {
      notify(`Side bets are capped at $${MAX_SIDE_BET_AMOUNT}.`, "error");
      return;
    }
    if ((data?.sideBetAcceptedCounts?.[currentUser.id] || 0) >= MAX_ACCEPTED_SIDE_BETS_PER_WEEK) {
      notify(`You already have ${MAX_ACCEPTED_SIDE_BETS_PER_WEEK} accepted side bets this week.`, "error");
      return;
    }
    const fullRecipient = profiles.find((profile) => betRecipients.includes(profile.id) && (data?.sideBetAcceptedCounts?.[profile.id] || 0) >= MAX_ACCEPTED_SIDE_BETS_PER_WEEK);
    if (fullRecipient) {
      notify(`${fullRecipient.display_name} has reached the weekly side bet limit.`, "error");
      return;
    }
    const ok = await postSideBet({ action: "create", gameId: selectedBetGame.id, creatorTeam: selectedCreatorTeam, amount: Number(betAmount), recipientIds: betRecipients });
    if (ok) {
      setBetRecipients([]);
      setBetAmount("20");
      setBetView("sent");
      notify("Side bet offer sent.", "success");
    }
  }

  const primaryNav: Array<{ id: Tab; label: string; icon: typeof Trophy }> = [
    { id: "picks", label: "Picks", icon: Zap },
    { id: "card", label: "My Card", icon: WalletCards },
    { id: "standings", label: "Standings", icon: Trophy },
    { id: "rules", label: "Rules", icon: Shield }
  ];

  return <div className="app-shell">
    <header className="scoreboard-header">
      <div className="scoreboard-main">
        <div className="brand-lockup">
          <img className="header-wordmark" src="/header-wordmark.png" alt="Shaw Family Pick'em" width={800} height={96} />
        </div>
        <div className="header-actions">
          <span className="header-refresh-indicator" role="status" aria-label={refreshing ? "Updating week" : undefined}>{refreshing && <LoaderCircle size={17} />}</span>
          {previewActive ? <div className="test-week-chip">Test Week</div> : availableWeeks.length > 0 && <div className="header-slate"><div className="week-select-wrap"><select aria-label="Select week" value={data.week} disabled={refreshing} onChange={(e) => { setStagedPicks(null); load(Number(e.target.value)); }} className="week-select">
            {availableWeeks.map((w) => <option key={w} value={w}>{w === 0 ? "Week 0" : `Week ${w}`}</option>)}
          </select><ChevronDown size={14} /></div></div>}
        </div>
      </div>
    </header>

    <nav className="primary-nav">
      <div className="primary-nav-inner">
        {primaryNav.map((item) => <button key={item.id} aria-current={tab === item.id ? "page" : undefined} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><span className="nav-icon"><item.icon size={19} />{item.id === "picks" && pendingOfferCount > 0 && <b>{pendingOfferCount}</b>}</span><span>{item.label}</span></button>)}
      </div>
    </nav>

    <main className="container">
      {message && <div className="error-card">{message}</div>}
      {previewActive && <div className="test-mode-banner"><span><FlaskConical size={16} /><span><strong>Board state preview</strong><small>No real picks or bank balances are changed</small></span></span><button type="button" onClick={() => { setTestWeekActive(false); setStatusFilter(defaultBoardStatus(data.games, clock, !data.weekOpenTime || new Date(data.weekOpenTime).getTime() <= clock)); setStatusFilterTouched(false); }}><X size={16} /> Exit</button></div>}

      {tab === "picks" && <section className="panel picks-panel">
        {!previewActive && !weekIsOpen && data.weekOpenTime && <div className="notice-card">This week opens for picks on {openText(data.weekOpenTime)} CT.</div>}
        <SectionTabs items={[{ id: "board", label: "Pick Board" }, { id: "sideBets", label: `Side Bets${pendingOfferCount ? ` (${pendingOfferCount})` : ""}` }]} value={picksView} onChange={(value) => setPicksView(value as PicksView)} />
        {picksView === "board" && <>
          <div className="view-select-row board-filter-row">
            <div className="compact-select status-select"><select aria-label="Choose game status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as GameStatusFilter); setStatusFilterTouched(true); }}>{(["OPEN", "LOCKED", "FINAL"] as GameStatusFilter[]).map((option) => <option key={option} value={option}>{option}</option>)}</select><ChevronDown size={15} /></div>
            <div className="compact-select league-select"><select aria-label="Choose league" value={leagueFilter} onChange={(event) => setLeagueFilter(event.target.value as LeagueFilter)}>{(["CFB", "NFL", "DOGS"] as LeagueFilter[]).map((option) => <option key={option} value={option}>{option}</option>)}</select><ChevronDown size={15} /></div>
          </div>
          {filteredGames.length === 0 && <div className="empty-state">No {statusFilter.toLowerCase()} {leagueFilter === "DOGS" ? "dog" : leagueFilter} games.</div>}
          <div className="game-days">
            {gameGroups.map((group) => <div className={`game-day-group ${statusFilter === "FINAL" ? "past-day-group" : ""}`} key={group.key}>
              <div className="game-day-marker"><b>{group.shortDay}</b><strong>{group.label}</strong><span /></div>
              <div className="game-list">{group.games.map((game) => <GameCard key={game.id} game={game} picks={cardPicks} statusFilter={statusFilter} leagueFilter={leagueFilter} weekIsOpen={weekIsOpen} now={clock} addPick={addPick} />)}</div>
            </div>)}
          </div>
        </>}
        {picksView === "sideBets" && <SideBetCenter
          view={betView}
          setView={setBetView}
          currentUser={currentUser}
          profiles={profiles}
          sideBets={sideBets}
          acceptedCounts={data.sideBetAcceptedCounts || {}}
          openGames={openBetGames}
          selectedGame={selectedBetGame}
          selectedCreatorTeam={selectedCreatorTeam}
          amount={betAmount}
          recipients={betRecipients}
          saving={savingBet}
          savingBetId={savingBetId}
          setGame={(gameId) => { setBetGameId(gameId); setBetCreatorTeam(""); }}
          setCreatorTeam={setBetCreatorTeam}
          setAmount={setBetAmount}
          toggleRecipient={toggleBetRecipient}
          createBet={createSideBet}
          respond={(action, sideBetId) => postSideBet({ action, sideBetId })}
        />}
      </section>}

      {tab === "card" && <section className="panel card-panel">
        <SectionTabs items={[{ id: "mine", label: "My Card" }, { id: "group", label: "League Cards" }]} value={cardView} onChange={(value) => setCardView(value as CardView)} />
        {cardView === "mine" && <>
          {!cardIsLocked && <CardProgress rule={rule} counts={regularCounts} hasDog={Boolean(myUnderdog)} dirty={stagedPicks !== null} />}
          <PickList picks={myUnderdog ? [...myRegular, myUnderdog] : myRegular} games={viewedGames} title="Picks" removePick={removePick} />
        </>}
        {cardView === "group" && <div className="group-list">
          {profiles.map((profile) => {
            const playerPicks = viewedPicks
              .filter((pick) => pick.user_id === profile.id)
              .sort((a, b) => Number(a.pick_type === "underdog") - Number(b.pick_type === "underdog"));
            return <div key={profile.id} className="group-card">
              <h3>{leagueCardsHidden && <EyeOff size={14} />} {profile.display_name}</h3>
              {playerPicks.length === 0 && <p className="muted group-empty-picks">No visible picks yet.</p>}
              {playerPicks.map((pick) => <VisiblePick key={pick.id} pick={pick} games={viewedGames} />)}
            </div>;
          })}
        </div>}
      </section>}

      {tab === "standings" && <section className="panel standings-panel">
        <SectionTabs items={[{ id: "standings", label: "Standings" }, { id: "bank", label: "Bank" }]} value={standingsView} onChange={(value) => setStandingsView(value as StandingsView)} />
        {standingsView === "standings" && <>
          <div className="scoreboard-heading heading-with-icon"><Trophy size={19} /><h2>Season standings</h2></div>
          <Leaderboard rows={seasonStandings} />
          <div className="subsection weekly-standings">
            <div className="standings-heading-row"><h2>Weekly standings</h2>{previewActive ? <span className="test-standings-label">Test Week</span> : <label><select aria-label="Select standings week" value={selectedStandingsWeek} onChange={(event) => setStandingsWeek(Number(event.target.value))}>{standingsWeeks.map((standingWeek) => <option key={standingWeek} value={standingWeek}>{standingWeek === 0 ? "Week 0" : `Week ${standingWeek}`}</option>)}</select><ChevronDown size={14} /></label>}</div>
            <Leaderboard rows={weeklyStandings} />
          </div>
        </>}
        {standingsView === "bank" && <>
          <div className="scoreboard-heading heading-with-icon"><Landmark size={19} /><h2>Bank balances</h2></div>
          <div className="bank-summary-grid">
            <div className="bank-summary-head"><span>Player</span><span>Balance</span></div>
            {bankTotals.map((row) => <div key={row.id} className="money-card"><span>{row.display_name}</span><strong className={row.total > 0 ? "money-pos" : row.total < 0 ? "money-neg" : ""}>{money(row.total)}</strong></div>)}
          </div>
          <div className="subsection bank-section">
            <div className="bank-section-heading standings-heading-row bank-results-heading">
              <h3>{previewActive ? "Test week results" : "Week results"}</h3>
              {previewActive ? <span className="test-standings-label">Week 3</span> : <label><select aria-label="Select Bank results week" value={selectedBankWeek} disabled={bankWeekLoading} onChange={(event) => void loadBankWeek(Number(event.target.value))}>{standingsWeeks.map((standingWeek) => <option key={standingWeek} value={standingWeek}>{standingWeek === 0 ? "Week 0" : `Week ${standingWeek}`}</option>)}</select>{bankWeekLoading ? <LoaderCircle className="bank-week-spinner" size={14} /> : <ChevronDown size={14} />}</label>}
            </div>
            <BankWeekResults rows={bankWeekStandings} picks={bankResultPicks} games={bankResultGames} amounts={bankWeekAmounts} />
          </div>
          <div className="subsection bank-section"><div className="bank-section-heading"><h3>Side bet ledger</h3></div><div className="ledger-list">{sideBets.filter((bet) => bet.status === "settled").length === 0 && <p className="muted">No settled side bets yet.</p>}{sideBets.filter((bet) => bet.status === "settled").map((bet) => <SideBetLedgerRow key={bet.id} bet={bet} currentUser={currentUser} />)}</div></div>
          {currentUser.is_admin && !previewActive && <button className="test-week-launch" onClick={() => { setTestWeekActive(true); setStagedPicks(null); setPicksView("board"); setCardView("mine"); setStatusFilter("LOCKED"); setStatusFilterTouched(true); setLeagueFilter("CFB"); setTab("picks"); }}><FlaskConical size={18} /><span><strong>Preview board states</strong><small>See locked upcoming, live, and final games</small></span><ChevronRight size={17} /></button>}
        </>}
      </section>}

      {tab === "rules" && <section className="panel rules-panel">
        <div className="section-title"><Shield size={19} /><div><h2>League rules</h2></div></div>
        <div className="rules-list">
          <RuleItem icon={WalletCards} title="Weekly card"><ul><li>Week 1: 3 CFB picks + dog.</li><li>Week 2: 5 CFB picks + dog.</li><li>Mixed weeks: 5 picks with at least 1 CFB and 1 NFL + dog.</li><li>After CFB: 2 NFL picks + dog.</li></ul></RuleItem>
          <RuleItem icon={Shield} title="Eligible games"><ul><li>Regular-season games only.</li><li>Bowls, CFP, and NFL playoffs are excluded.</li><li>Every Chargers game is excluded.</li></ul></RuleItem>
          <RuleItem icon={Zap} title="Underdog"><ul><li>+7 to +9.5 = +1W.</li><li>+10 to +19.5 = +2W.</li><li>+20 or more = +3W.</li><li>The dog must win outright.</li><li>A missed dog does not add a loss.</li></ul></RuleItem>
          <RuleItem icon={Trophy} title="Standings"><ul><li>Season and weekly standings use win percentage.</li><li>Equal percentages are broken by total wins.</li><li>The season winner receives $300.</li></ul></RuleItem>
          <RuleItem icon={CircleDollarSign} title="Weekly bank"><ul><li>Last pays $20 to first.</li><li>Second pays $10 to first.</li><li>Tied last pays $15 each.</li><li>Tied first splits $20.</li><li>A three-way tie pays $0.</li><li>Payments post automatically after all three cards are final.</li></ul></RuleItem>
          <RuleItem icon={Trophy} title="Perfect week"><ul><li>Available only during five-game weeks.</li><li>A perfect card doubles all weekly payments.</li></ul></RuleItem>
          <RuleItem icon={Lock} title="Pick locks"><ul><li>Tue-Fri lines update for the final time at 6 PM CT the day before kickoff.</li><li>Tue-Fri picks lock at 7 PM CT the day before kickoff.</li><li>Sat-Mon lines update for the final time Friday at 6 PM CT.</li><li>Sat-Mon picks lock Friday at 7 PM CT.</li></ul></RuleItem>
          <RuleItem icon={Send} title="Side bets"><ul><li>Spread bets only.</li><li>$20 maximum per bet.</li><li>Each player may have 3 accepted bets per week.</li><li>Offers must be accepted before kickoff.</li><li>Settled bets go directly into the bank.</li></ul></RuleItem>
        </div>
      </section>}
    </main>
    {tab === "picks" && stagedPicks !== null && <button className="floating-review" onClick={() => { setTab("card"); setCardView("mine"); }}>
      <span><b>Unsaved picks</b><small>Review your card before games lock</small></span>
      <strong>Review & save <ChevronRight size={17} /></strong>
    </button>}
    {tab === "card" && cardView === "mine" && !previewActive && stagedPicks !== null && <button className="sticky-card-save" disabled={savingPicks} onClick={() => savePicks(cardPicks)}><Save size={17} /> {savingPicks ? "Saving picks…" : "Save picks"}</button>}
    {toast && <div className={`toast ${toast.tone}`} role="status" aria-live="polite">{toast.tone === "success" && <CircleCheckBig size={18} />}{toast.tone === "error" && <X size={18} />}<span>{toast.message}</span></div>}
  </div>;
}

function SectionTabs({ items, value, onChange }: { items: Array<{ id: string; label: string }>; value: string; onChange: (value: string) => void }) {
  return <div className="section-tabs">{items.map((item) => <button key={item.id} className={value === item.id ? "active" : ""} onClick={() => onChange(item.id)}>{item.label}</button>)}</div>;
}

function RankNumber({ rank, className }: { rank: number; className: string }) {
  const labels: Record<number, string> = { 1: "First place", 2: "Second place", 3: "Third place" };
  return <span className={`${className} rank-${rank}`} aria-label={labels[rank]}>{rank}</span>;
}

function BankWeekResults({ rows, picks, games, amounts }: { rows: Array<Standing & { rank?: number }>; picks: Pick[]; games: Game[]; amounts: Record<string, number | null> }) {
  return <div className="bank-week-results">{rows.map((row, index) => {
    const playerPicks = picks
      .filter((pick) => pick.user_id === row.user_id)
      .sort((a, b) => {
        const typeOrder = Number(a.pick_type === "underdog") - Number(b.pick_type === "underdog");
        if (typeOrder !== 0) return typeOrder;
        const gameA = games.find((game) => game.id === a.game_id) || a.game;
        const gameB = games.find((game) => game.id === b.game_id) || b.game;
        return new Date(gameA?.commence_time || 0).getTime() - new Date(gameB?.commence_time || 0).getTime();
      });
    const amount = amounts[row.user_id];
    const rank = row.rank || index + 1;
    return <details className="bank-player-result" key={row.user_id}>
      <summary><span className="bank-player-identity"><RankNumber rank={rank} className="bank-result-rank" /><strong>{row.display_name}</strong></span><span className={`bank-result-amount ${amount != null && amount > 0 ? "money-pos" : amount != null && amount < 0 ? "money-neg" : ""}`}>{amount == null ? "—" : money(amount)}</span><span className="bank-result-record">{row.wins}-{row.losses}-{row.pushes}</span><ChevronDown size={16} /></summary>
      {!playerPicks.length && <p className="muted">No visible picks yet.</p>}
      {playerPicks.map((pick) => {
        const game = games.find((item) => item.id === pick.game_id) || pick.game;
        const displayedSpread = pick.locked_spread != null ? Number(pick.locked_spread) : game ? normalizeSpreadForSelectedTeam(pick.selected_team, game.current_spread_team, game.current_spread) : null;
        const resultLabel = pick.result === "win" ? "W" : pick.result === "loss" ? "L" : pick.result === "push" ? "P" : "—";
        return <div className="bank-game-result" key={pick.id}>
          <TeamLogo url={game ? logoForTeam(game, pick.selected_team) : null} name={pick.selected_team} />
          <div><strong>{game ? displayTeamName(game, pick.selected_team) : pick.selected_team}{game && <PossessionIcon game={game} team={pick.selected_team} />} {spreadText(displayedSpread)} {pick.pick_type === "underdog" && <> · <span className="dog-tag">Dog +{pick.underdog_win_value || "?"}W</span></>}</strong><p>{game ? `${displayTeamName(game, game.away_team)} at ${displayTeamName(game, game.home_team)} · ${cardGameStateText(game, true)}` : "Matchup unavailable"}</p></div>
          <span className={`test-result ${pick.result}`}>{resultLabel}</span>
        </div>;
      })}
    </details>;
  })}</div>;
}

function Leaderboard({ rows }: { rows: Array<Standing & { rank?: number }> }) {
  function rankFor(index: number) {
    if (rows[index].rank) return rows[index].rank;
    const firstMatch = rows.findIndex((row) => row.win_pct === rows[index].win_pct && row.wins === rows[index].wins);
    return firstMatch + 1;
  }

  return <div className="leaderboard">
    <div className="leaderboard-labels"><span>Rank</span><span>Player</span><span>W</span><span>L</span><span>P</span><span>Win %</span></div>
    {rows.map((row, index) => {
      const rank = rankFor(index);
      return <div className="leaderboard-row" key={row.user_id}>
        <RankNumber rank={rank} className="leaderboard-rank" />
        <div className="leaderboard-player"><strong>{row.display_name}</strong></div>
        <span className="leaderboard-stat">{row.wins}</span>
        <span className="leaderboard-stat">{row.losses}</span>
        <span className="leaderboard-stat">{row.pushes}</span>
        <strong className="leaderboard-pct">{pctText(row.win_pct)}</strong>
      </div>;
    })}
  </div>;
}

function RuleItem({ icon: Icon, title, children }: { icon: typeof Trophy; title: string; children: React.ReactNode }) {
  return <details className="rule-item">
    <summary><span className="rule-icon"><Icon size={19} /></span><strong>{title}</strong><ChevronDown className="rule-chevron" size={17} /></summary>
    <div className="rule-copy">{children}</div>
  </details>;
}

function LoadingShell() {
  const loadingNav = [
    { label: "Picks", icon: Zap },
    { label: "My Card", icon: WalletCards },
    { label: "Standings", icon: Trophy },
    { label: "Rules", icon: Shield }
  ];

  return <div className="app-shell loading-shell">
    <header className="scoreboard-header">
      <div className="scoreboard-main">
        <div className="brand-lockup"><img className="header-wordmark" src="/header-wordmark.png" alt="Shaw Family Pick'em" width={800} height={96} /></div>
      </div>
    </header>
    <nav className="primary-nav" aria-label="Main navigation">
      <div className="primary-nav-inner">
        {loadingNav.map((item, index) => <button type="button" key={item.label} className={index === 0 ? "active" : ""} disabled><span className="nav-icon"><item.icon size={19} /></span><span>{item.label}</span></button>)}
      </div>
    </nav>
    <main className="initial-loading" role="status" aria-label="Loading app"><LoaderCircle size={30} /></main>
  </div>;
}

function SideBetCenter({ view, setView, currentUser, profiles, sideBets, acceptedCounts, openGames, selectedGame, selectedCreatorTeam, amount, recipients, saving, savingBetId, setGame, setCreatorTeam, setAmount, toggleRecipient, createBet, respond }: {
  view: BetView;
  setView: (value: BetView) => void;
  currentUser: Profile;
  profiles: Profile[];
  sideBets: SideBet[];
  acceptedCounts: Record<string, number>;
  openGames: Game[];
  selectedGame?: Game;
  selectedCreatorTeam: string;
  amount: string;
  recipients: string[];
  saving: boolean;
  savingBetId: string | null;
  setGame: (value: string) => void;
  setCreatorTeam: (value: string) => void;
  setAmount: (value: string) => void;
  toggleRecipient: (value: string) => void;
  createBet: () => void;
  respond: (action: "accept" | "decline" | "cancel" | "clear", sideBetId: string) => Promise<boolean>;
}) {
  const [confirmingBetId, setConfirmingBetId] = useState<string | null>(null);
  const received = sideBets.filter((bet) => bet.creator_id !== currentUser.id && bet.targets?.some((target) => target.recipient_id === currentUser.id));
  const sent = sideBets.filter((bet) => bet.creator_id === currentUser.id);
  const otherPlayers = profiles.filter((profile) => profile.id !== currentUser.id);
  const offeredTeam = selectedGame ? (selectedCreatorTeam === selectedGame.home_team ? selectedGame.away_team : selectedGame.home_team) : "";
  const creatorSpread = selectedGame ? normalizeSpreadForSelectedTeam(selectedCreatorTeam, selectedGame.current_spread_team, selectedGame.current_spread) : null;
  const confirmingBet = received.find((bet) => bet.id === confirmingBetId);
  const acceptedCount = acceptedCounts[currentUser.id] || 0;
  const limitReached = acceptedCount >= MAX_ACCEPTED_SIDE_BETS_PER_WEEK;

  async function acceptConfirmedBet() {
    if (!confirmingBetId) return;
    const accepted = await respond("accept", confirmingBetId);
    if (accepted) setConfirmingBetId(null);
  }

  return <div className="side-bet-center">
    <div className="view-select-row"><div className="compact-select"><select aria-label="Choose side bet view" value={view} onChange={(event) => setView(event.target.value as BetView)}><option value="received">For You</option><option value="sent">Sent</option><option value="new">Make Offer</option></select><ChevronDown size={15} /></div></div>

    {view === "new" && <div className="bet-composer">
      <div className="section-title"><Send size={19} /><div><h2>Make an offer</h2></div></div>
      {limitReached && <div className="empty-state">You have reached the {MAX_ACCEPTED_SIDE_BETS_PER_WEEK} side bet limit for this week.</div>}
      {openGames.length === 0 && <div className="empty-state">No games with an open spread are available.</div>}
      {!limitReached && selectedGame && <div className="offer-flow">
        <section className="offer-block offer-game-amount">
          <label><span className="field-label">Game</span><select id="side-bet-game" aria-label="Side bet game" className="input" value={selectedGame.id} onChange={(event) => setGame(event.target.value)}>
              {openGames.map((game) => <option key={game.id} value={game.id}>{dt(game.commence_time)} · {displayTeamName(game, game.away_team)} at {displayTeamName(game, game.home_team)}</option>)}
            </select></label>
          <label><span className="field-label">Amount</span><div className="money-input"><b>$</b><input aria-label="Side bet amount" type="number" inputMode="decimal" min="1" max={MAX_SIDE_BET_AMOUNT} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></div></label>
        </section>

        <section className="offer-block offer-side-block">
          <span className="field-label">Your side</span>
          <div className="offer-team-select">
            {[selectedGame.away_team, selectedGame.home_team].map((team) => <button type="button" key={team} className={selectedCreatorTeam === team ? "active" : ""} onClick={() => setCreatorTeam(team)}>
              <TeamLogo url={logoForTeam(selectedGame, team)} name={team} />
              <span className="offer-team-name">{displayTeamName(selectedGame, team)}</span>
              <span className="offer-team-line"><strong>{spreadForTeam(selectedGame, team)}</strong></span>
            </button>)}
          </div>
        </section>

        <section className="offer-block offer-fields">
          <fieldset><legend className="field-label">Send to</legend><div className="recipient-grid">{otherPlayers.map((profile) => {
            const recipientFull = (acceptedCounts[profile.id] || 0) >= MAX_ACCEPTED_SIDE_BETS_PER_WEEK;
            return <label key={profile.id} className={`${recipients.includes(profile.id) ? "checked" : ""} ${recipientFull ? "disabled" : ""}`.trim()}><input type="checkbox" disabled={recipientFull} checked={recipients.includes(profile.id)} onChange={() => toggleRecipient(profile.id)} /><span>{profile.display_name}{recipientFull ? " · 3/3" : ""}</span></label>;
          })}</div></fieldset>
        </section>

        <div className="offer-review"><div className="offer-review-head"><span>Offer summary</span><strong>{stakeMoney(Number(amount || 0))}</strong></div><div className="bet-preview">
          <div><span>You keep</span><strong>{displayTeamName(selectedGame, selectedCreatorTeam)} {spreadText(creatorSpread)}</strong></div>
          <div><span>They get</span><strong>{displayTeamName(selectedGame, offeredTeam)} {spreadText(creatorSpread == null ? null : -creatorSpread)}</strong></div>
        </div></div>
        <button className="btn accent full" disabled={saving || Number(amount) <= 0 || Number(amount) > MAX_SIDE_BET_AMOUNT || !recipients.length} onClick={createBet}><Send size={15} /> {saving ? "Sending…" : "Send offer"}</button>
      </div>}
    </div>}

    {view === "received" && <SideBetList bets={received} mode="received" currentUser={currentUser} empty="No offers sent to you yet." saving={saving} savingBetId={savingBetId} canAccept={!limitReached} requestAccept={setConfirmingBetId} respond={respond} />}
    {view === "sent" && <SideBetList bets={sent} mode="sent" currentUser={currentUser} empty="You have not sent any offers yet." saving={saving} savingBetId={savingBetId} canAccept={!limitReached} requestAccept={setConfirmingBetId} respond={respond} />}

    {confirmingBet && <div className="confirmation-backdrop">
      <section className="confirmation-sheet" role="dialog" aria-modal="true" aria-labelledby="accept-bet-title">
        <div className="confirmation-icon"><CircleDollarSign size={22} /></div>
        <div className="confirmation-heading"><span>Review side bet</span><h2 id="accept-bet-title">Accept {stakeMoney(Number(confirmingBet.amount))} bet?</h2></div>
        <div className="confirmation-matchup">
          <div><span>You take</span><strong>{confirmingBet.game ? displayTeamName(confirmingBet.game, confirmingBet.offered_team) : confirmingBet.offered_team} {spreadText(Number(confirmingBet.offered_spread))}</strong></div>
          <div><span>{confirmingBet.creator?.display_name || "Opponent"} keeps</span><strong>{confirmingBet.game ? displayTeamName(confirmingBet.game, confirmingBet.creator_team) : confirmingBet.creator_team} {spreadText(Number(confirmingBet.creator_spread))}</strong></div>
        </div>
        {confirmingBet.game && <p className="confirmation-kickoff">{dt(confirmingBet.game.commence_time)}</p>}
        <div className="confirmation-actions"><button className="btn secondary" disabled={saving} onClick={() => setConfirmingBetId(null)}>Cancel</button><button className="btn accept" disabled={saving} onClick={acceptConfirmedBet}><Check size={16} /> {saving ? "Accepting…" : "Accept bet"}</button></div>
      </section>
    </div>}
  </div>;
}

function SideBetList({ bets, mode, currentUser, empty, saving, savingBetId, canAccept, requestAccept, respond }: { bets: SideBet[]; mode: "received" | "sent"; currentUser: Profile; empty: string; saving: boolean; savingBetId: string | null; canAccept: boolean; requestAccept: (sideBetId: string) => void; respond: (action: "accept" | "decline" | "cancel" | "clear", sideBetId: string) => Promise<boolean> }) {
  const sorted = [...bets].sort((a, b) => Number(b.status === "open") - Number(a.status === "open") || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return <div className="side-bet-list">{!sorted.length && <div className="empty-state">{empty}</div>}{sorted.map((bet) => <SideBetCard key={bet.id} bet={bet} mode={mode} currentUser={currentUser} saving={saving} working={savingBetId === bet.id} canAccept={canAccept} requestAccept={requestAccept} respond={respond} />)}</div>;
}

function SideBetCard({ bet, mode, currentUser, saving, working, canAccept, requestAccept, respond }: { bet: SideBet; mode: "received" | "sent"; currentUser: Profile; saving: boolean; working: boolean; canAccept: boolean; requestAccept: (sideBetId: string) => void; respond: (action: "accept" | "decline" | "cancel" | "clear", sideBetId: string) => Promise<boolean> }) {
  const game = bet.game;
  const creatorName = bet.creator?.display_name || "A player";
  const target = bet.targets?.find((row) => row.recipient_id === currentUser.id);
  const targetNames = bet.targets?.map((row) => row.recipient?.display_name).filter(Boolean).join(" or ") || "player";
  const offerOpen = bet.status === "open" && target?.response === "pending" && Boolean(game && new Date(game.commence_time) > new Date());
  const creatorSideTeam = bet.creator_team;
  const creatorSideSpread = Number(bet.creator_spread);
  const creatorSideName = game ? displayTeamName(game, creatorSideTeam) : creatorSideTeam;
  const offeredSideTeam = bet.offered_team;
  const offeredSideSpread = Number(bet.offered_spread);
  const offeredSideName = game ? displayTeamName(game, offeredSideTeam) : offeredSideTeam;
  const awayName = game ? displayTeamName(game, game.away_team) : "";
  const homeName = game ? displayTeamName(game, game.home_team) : "";
  const matchupText = !game
    ? `${creatorSideName} ${spreadText(creatorSideSpread)}`
    : creatorSideTeam === game.away_team
      ? `${awayName} ${spreadText(creatorSideSpread)} at ${homeName}`
      : `${awayName} at ${homeName} ${spreadText(creatorSideSpread)}`;
  const declinedTarget = bet.targets?.find((row) => row.response === "declined");
  const acceptedName = bet.accepted_by_profile?.display_name;
  const responseName = acceptedName ||
    declinedTarget?.recipient?.display_name ||
    (declinedTarget?.recipient_id === currentUser.id ? currentUser.display_name : "") ||
    (bet.status === "declined" ? (mode === "sent" ? targetNames : currentUser.display_name) : "") ||
    (bet.status === "cancelled" ? creatorName : "") ||
    (mode === "sent" ? targetNames : creatorName);
  const responseAction = acceptedName
    ? "Accepted"
    : declinedTarget || bet.status === "declined"
      ? "Declined"
      : bet.status === "cancelled"
        ? "Cancelled"
        : bet.status === "expired"
          ? "Expired"
          : "Offered";
  const responseTone = responseAction === "Accepted" ? "accepted" : ["Declined", "Cancelled", "Expired"].includes(responseAction) ? "declined" : "pending";
  const actionFirst = responseAction === "Offered";
  const amountDisplay = sideBetAmountForUser(bet, currentUser.id);
  const canClearOffer = mode === "received"
    ? target?.response === "declined" || bet.status === "cancelled"
    : ["declined", "cancelled"].includes(bet.status);

  return <article className={`side-bet-card mode-${mode} ${offerOpen ? "open" : ""} ${saving && !working ? "background-busy" : ""}`}>
    <div className="side-bet-offer-row">
      <TeamLogo url={game ? logoForTeam(game, creatorSideTeam) : null} name={creatorSideTeam} />
      <div className="side-bet-offer-copy"><strong>{matchupText}</strong><p>{actionFirst ? <><span className={`side-bet-response ${responseTone}`}>{responseAction}</span> {responseName}</> : <>{responseName} <span className={`side-bet-response ${responseTone}`}>{responseAction}</span></>} {offeredSideName} {spreadText(offeredSideSpread)}{game ? ` · ${dt(game.commence_time)}` : ""}</p></div>
      <strong className={`side-bet-offer-amount ${amountDisplay.tone}`}>{amountDisplay.text}</strong>
    </div>
    {mode === "received" && offerOpen && <div className="actions"><button className={`btn accept ${working ? "working" : ""}`} disabled={saving || !canAccept} onClick={() => requestAccept(bet.id)}><Check size={15} /> {canAccept ? "Review & accept" : "Limit reached"}</button><button className={`btn secondary ${working ? "working" : ""}`} disabled={saving} onClick={() => respond("decline", bet.id)}><X size={15} /> Decline</button></div>}
    {mode === "sent" && bet.status === "open" && <div className="actions"><button className={`btn secondary ${working ? "working" : ""}`} disabled={saving} onClick={() => respond("cancel", bet.id)}><X size={15} /> Cancel offer</button></div>}
    {canClearOffer && <div className="actions clear-offer-actions"><button className={`btn secondary ${working ? "working" : ""}`} disabled={saving} onClick={() => respond("clear", bet.id)}><Trash2 size={14} /> Clear</button></div>}
  </article>;
}

function SideBetLedgerRow({ bet, currentUser }: { bet: SideBet; currentUser: Profile }) {
  const game = bet.game;
  const creatorName = bet.creator?.display_name || "Player";
  const acceptorName = bet.accepted_by_profile?.display_name || "Opponent";
  const favoriteTeam = Number(bet.creator_spread) < 0 ? bet.creator_team : Number(bet.offered_spread) < 0 ? bet.offered_team : bet.creator_team;
  const favoriteSpread = favoriteTeam === bet.creator_team ? Number(bet.creator_spread) : Number(bet.offered_spread);
  const favoriteName = game ? displayTeamName(game, favoriteTeam) : favoriteTeam;
  const otherTeam = favoriteTeam === bet.creator_team ? bet.offered_team : bet.creator_team;
  const otherName = game ? displayTeamName(game, otherTeam) : otherTeam;
  const coveredTeam = bet.result === "creator_win" ? bet.creator_team : bet.result === "acceptor_win" ? bet.offered_team : null;
  const winnerName = bet.result === "creator_win" ? creatorName : bet.result === "acceptor_win" ? acceptorName : null;
  const amountDisplay = sideBetAmountForUser(bet, currentUser.id);
  return <div className="ledger-row side-bet-ledger-row">
    {bet.result === "push" ? <span className="tie-icon" role="img" aria-label="Tie">👔</span> : <TeamLogo url={game && coveredTeam ? logoForTeam(game, coveredTeam) : null} name={coveredTeam || "Winner"} />}
    <div><strong>{otherName} vs {favoriteName} {spreadText(favoriteSpread)}</strong><p>{creatorName} vs {acceptorName} · {winnerName ? `${winnerName} Wins` : "Push"}</p></div>
    <strong className={amountDisplay.tone}>{amountDisplay.text}</strong>
  </div>;
}

function GameCard({ game, picks, statusFilter, leagueFilter, weekIsOpen, now, addPick }: { game: Game; picks: Pick[]; statusFilter: GameStatusFilter; leagueFilter: LeagueFilter; weekIsOpen: boolean; now: number; addPick: (game: Game, team: string, pickType: PickType) => void }) {
  const closed = isClosed(game) || !weekIsOpen;
  const hasFinalScore = game.final_away_score != null && game.final_home_score != null;
  const hasLiveScore = game.live_state !== "pre" && game.live_away_score != null && game.live_home_score != null;
  const hasScore = hasFinalScore || hasLiveScore;
  const gameIsFinal = isFinalGame(game);
  const gameIsLive = !gameIsFinal && new Date(game.commence_time).getTime() <= now;
  const awayScore = hasFinalScore ? game.final_away_score : game.live_away_score;
  const homeScore = hasFinalScore ? game.final_home_score : game.live_home_score;
  const dogView = leagueFilter === "DOGS";
  const existing = picks.find((p) => p.game_id === game.id);
  const selectType: PickType = dogView ? "underdog" : "regular";
  const existingMatchesView = existing?.pick_type === selectType;
  const canChangeExisting = existing?.status === "draft" && existingMatchesView;
  const awayDogValue = teamDogValue(game, game.away_team);
  const homeDogValue = teamDogValue(game, game.home_team);

  function sideLine(team: string) {
    if (dogView) return dogLineText(game, team);
    return spreadForTeam(game, team);
  }

  function resultSpread(team: string) {
    if (existingMatchesView && existing?.locked_spread != null) {
      return Number(team === existing.selected_team ? existing.locked_spread : -existing.locked_spread);
    }
    return normalizeSpreadForSelectedTeam(team, game.current_spread_team, game.current_spread);
  }

  function resultLine(team: string) {
    const spread = resultSpread(team);
    if (!dogView) return spreadText(spread);
    const dogValue = underdogWinValue(spread);
    return dogValue > 0 ? `${spreadText(spread)} = +${dogValue}W` : null;
  }

  function sideIsSelectable(team: string) {
    if (statusFilter !== "OPEN") return false;
    if (closed) return false;
    if (isChargersTeam(team)) return false;
    if (!game.current_spread_team || game.current_spread == null) return false;
    if (dogView) return teamDogValue(game, team) > 0;
    if (existingMatchesView && !canChangeExisting) return false;
    return true;
  }

  function choose(team: string) {
    if (!sideIsSelectable(team)) return;
    addPick(game, team, selectType);
  }

  const awaySelectable = sideIsSelectable(game.away_team);
  const homeSelectable = sideIsSelectable(game.home_team);
  const awayBlocked = isChargersTeam(game.away_team);
  const homeBlocked = isChargersTeam(game.home_team);
  const awayOpponentOnly = dogView && !hasScore && awayDogValue === 0;
  const homeOpponentOnly = dogView && !hasScore && homeDogValue === 0;

  function pickedResult(): GameOutcome | null {
    if (!existingMatchesView || !existing || !gameIsFinal || awayScore == null || homeScore == null) return null;
    if (existing.result !== "pending") return existing.result;
    if (existing.pick_type === "underdog") {
      return gradeUnderdogOutright(existing.selected_team, game.home_team, game.away_team, homeScore, awayScore);
    }
    const spread = existing.locked_spread ?? normalizeSpreadForSelectedTeam(existing.selected_team, game.current_spread_team, game.current_spread);
    return spread == null ? null : gradeAgainstSpread(existing.selected_team, game.home_team, game.away_team, homeScore, awayScore, spread);
  }

  function resultWithoutPick(team: string): GameOutcome | null {
    if (!gameIsFinal || awayScore == null || homeScore == null) return null;
    if (dogView) return gradeUnderdogOutright(team, game.home_team, game.away_team, homeScore, awayScore);
    const spread = normalizeSpreadForSelectedTeam(team, game.current_spread_team, game.current_spread);
    return spread == null ? null : gradeAgainstSpread(team, game.home_team, game.away_team, homeScore, awayScore, spread);
  }

  const finalPickResult = pickedResult();
  function finalResultForTeam(team: string): GameOutcome | null {
    if (!gameIsFinal) return null;
    if (!existingMatchesView || !existing || !finalPickResult) return resultWithoutPick(team);
    if (finalPickResult === "push") return "push";
    if (team === existing.selected_team) return finalPickResult;
    return finalPickResult === "win" ? "loss" : "win";
  }

  function resultClasses(team: string) {
    const classes: string[] = [];
    const outcome = finalResultForTeam(team);
    if (outcome) classes.push(`outcome-${outcome}`);
    if (existingMatchesView && existing?.selected_team === team && finalPickResult) {
      classes.push(`picked-${finalPickResult}`);
    }
    return classes.join(" ");
  }

  const showScoreValues = hasScore && (gameIsLive || gameIsFinal);
  const awayResultLine = showScoreValues ? resultLine(game.away_team) : null;
  const homeResultLine = showScoreValues ? resultLine(game.home_team) : null;

  return <article className={`game-card matchup-card filter-${leagueFilter.toLowerCase()} status-${statusFilter.toLowerCase()} ${dogView ? "dog-view" : ""} ${closed ? "closed" : ""} ${existingMatchesView ? "selected" : ""} ${gameIsFinal && hasScore ? "final-outcome" : ""} ${showScoreValues ? "score-values" : ""}`}>
    <div className="game-head compact-game-head">
      <div className="game-time-group">{gameIsFinal ? <span className="game-final-status">Final</span> : gameIsLive ? <span className="game-live-status">{liveGameStatus(game)}</span> : <span className="game-time">{timeText(game.commence_time)}</span>}</div>
      {statusFilter === "OPEN" && <div className="kick">Closes {lockText(game.lock_time)}</div>}
    </div>

    <div className="stacked-matchup" role="group" aria-label={`${displayTeamName(game, game.away_team)} at ${displayTeamName(game, game.home_team)}`}>
      <button
        type="button"
        className={`team-row away-row ${awaySelectable ? "selectable" : ""} ${existingMatchesView && existing?.selected_team === game.away_team ? "picked-side" : ""} ${awayOpponentOnly ? "opponent-only" : ""} ${awayBlocked ? "blocked-side" : ""} ${resultClasses(game.away_team)}`}
        disabled={!awaySelectable}
        onClick={() => choose(game.away_team)}
      >
        <TeamLogo url={logoForTeam(game, game.away_team)} name={game.away_team} />
        {showScoreValues ? <span className="team-name-line"><span className="team-name">{displayTeamName(game, game.away_team)}</span><PossessionIcon game={game} team={game.away_team} /></span> : <span className="team-name">{displayTeamName(game, game.away_team)}</span>}
        {showScoreValues && <span className="team-result-line">{awayResultLine && <span className="team-result-spread">{awayResultLine}</span>}</span>}
        {showScoreValues ? <span className="team-final-score">{awayScore}</span> : !awayOpponentOnly && <span className={`team-spread ${awayBlocked ? "unavailable" : ""}`}><span>{awayBlocked ? "Not eligible" : sideLine(game.away_team)}</span></span>}
      </button>

      <button
        type="button"
        className={`team-row home-row ${homeSelectable ? "selectable" : ""} ${existingMatchesView && existing?.selected_team === game.home_team ? "picked-side" : ""} ${homeOpponentOnly ? "opponent-only" : ""} ${homeBlocked ? "blocked-side" : ""} ${resultClasses(game.home_team)}`}
        disabled={!homeSelectable}
        onClick={() => choose(game.home_team)}
      >
        <TeamLogo url={logoForTeam(game, game.home_team)} name={game.home_team} />
        {showScoreValues ? <span className="team-name-line"><span className="team-name">{displayTeamName(game, game.home_team)}</span><PossessionIcon game={game} team={game.home_team} /></span> : <span className="team-name">{displayTeamName(game, game.home_team)}</span>}
        {showScoreValues && <span className="team-result-line">{homeResultLine && <span className="team-result-spread">{homeResultLine}</span>}</span>}
        {showScoreValues ? <span className="team-final-score">{homeScore}</span> : !homeOpponentOnly && <span className={`team-spread ${homeBlocked ? "unavailable" : ""}`}><span>{homeBlocked ? "Not eligible" : sideLine(game.home_team)}</span></span>}
      </button>
    </div>
  </article>;
}

function TeamLogo({ url, name }: { url?: string | null; name: string }) {
  if (url) return <img src={url} alt="" className="team-logo" width={34} height={34} loading="lazy" decoding="async" />;
  return <div className="team-logo fallback">{name.slice(0, 1)}</div>;
}

function PossessionIcon({ game, team }: { game: Game; team: string }) {
  if (game.live_state !== "in" || game.live_possession_team !== team) return null;
  return <span className="possession-icon" role="img" aria-label="Possession" title="Possession">
    <svg viewBox="0 0 24 14" aria-hidden="true">
      <path d="M1 7C3.8 2.7 7.4 1 12 1s8.2 1.7 11 6c-2.8 4.3-6.4 6-11 6S3.8 11.3 1 7Z" fill="currentColor" />
      <path d="M8 7h8M10 4.8v4.4M12 4.8v4.4M14 4.8v4.4" fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="1.3" />
    </svg>
  </span>;
}

function CardProgress({ rule, counts, hasDog, dirty }: { rule: WeekRule; counts: { total: number; cfb: number; nfl: number }; hasDog: boolean; dirty: boolean }) {
  const ok = counts.total === rule.regularTotal && counts.cfb >= rule.cfbMinimum && counts.nfl >= rule.nflMinimum && hasDog;
  const completeSlots = Math.min(counts.total + Number(hasDog), rule.regularTotal + 1);
  const progress = completeSlots / (rule.regularTotal + 1) * 100;
  const countText = rule.phase === "opening" || rule.phase === "college"
    ? `${counts.cfb}/${rule.regularTotal} CFB spreads · dog ${hasDog ? "set" : "open"}`
    : `${counts.total}/${rule.regularTotal} spreads · ${counts.cfb} CFB · ${counts.nfl} NFL · dog ${hasDog ? "set" : "open"}`;
  return <div className={`card-progress ${ok ? "complete" : ""} ${dirty ? "dirty" : ""}`}>
    <div className="card-progress-copy">
      <div className="card-progress-heading">
        <strong>{ok ? "Card complete" : "Build your card"}</strong>
        <span className={`card-progress-state ${dirty ? "unsaved" : "saved"}`}>{!dirty && <CircleCheckBig size={14} />}{dirty ? "Unsaved changes" : "Picks saved"}</span>
      </div>
      <span className="card-progress-count">{countText}</span>
    </div>
    <div className="progress-track" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
  </div>;
}

function PickList({ picks, games, title, removePick }: { picks: Pick[]; games: Game[]; title: string; removePick: (p: Pick) => void }) {
  return <div className="pick-section"><h3>{title}</h3>{!picks.length && <p className="muted card-empty-picks">None yet.</p>}{picks.map((pick) => {
    const game = games.find((g) => g.id === pick.game_id) || pick.game;
    const locked = pick.status === "locked" || Boolean(game && isClosed(game));
    const graded = pick.result !== "pending";
    const displayedSpread = pick.locked_spread != null ? Number(pick.locked_spread) : game ? normalizeSpreadForSelectedTeam(pick.selected_team, game.current_spread_team, game.current_spread) : null;
    const matchupText = game ? `${displayTeamName(game, game.away_team)} at ${displayTeamName(game, game.home_team)}` : "Matchup unavailable";
    const gameState = game ? cardGameStateText(game, locked) : "game status unavailable";
    const resultLabel = pick.result === "win" ? "W" : pick.result === "loss" ? "L" : "P";
    return <div className="pick-card" key={pick.id}>
      <div className="pick-top"><TeamLogo url={game ? logoForTeam(game, pick.selected_team) : null} name={pick.selected_team} /><div className="pick-copy"><p className="pick-title">{game ? displayTeamName(game, pick.selected_team) : pick.selected_team}{game && <PossessionIcon game={game} team={pick.selected_team} />} {spreadText(displayedSpread)} {pick.pick_type === "underdog" && <> · <span className="dog-tag">Dog +{pick.underdog_win_value || "?"}W</span></>}</p><p className="pick-meta">{matchupText} · {gameState}</p></div><div className="pick-row-actions">{graded ? <span className={`badge pick-result-${pick.result}`}>{resultLabel}</span> : !locked && <span className="badge open">editable</span>}{!locked && <button className="icon-btn" aria-label={`Remove ${pick.selected_team}`} onClick={() => removePick(pick)}><X size={16} /></button>}</div></div>
    </div>;
  })}</div>;
}

function VisiblePick({ pick, games }: { pick: Pick; games: Game[] }) {
  const game = games.find((g) => g.id === pick.game_id) || pick.game;
  const locked = pick.status === "locked" || Boolean(game && isClosed(game));
  const graded = pick.result !== "pending";
  const displayedSpread = pick.locked_spread != null ? Number(pick.locked_spread) : game ? normalizeSpreadForSelectedTeam(pick.selected_team, game.current_spread_team, game.current_spread) : null;
  const resultLabel = pick.result === "win" ? "W" : pick.result === "loss" ? "L" : "P";
  const matchup = game ? `${displayTeamName(game, game.away_team)} at ${displayTeamName(game, game.home_team)}` : "Matchup unavailable";
  const gameState = game ? cardGameStateText(game, locked) : "game status unavailable";
  return <div className="visible-pick"><TeamLogo url={game ? logoForTeam(game, pick.selected_team) : null} name={pick.selected_team} /><div className="visible-pick-copy"><strong>{game ? displayTeamName(game, pick.selected_team) : pick.selected_team}{game && <PossessionIcon game={game} team={pick.selected_team} />} {spreadText(displayedSpread)} {pick.pick_type === "underdog" && <> · <span className="dog-tag">Dog +{pick.underdog_win_value || "?"}W</span></>}</strong><p>{matchup} · {gameState}</p></div><div className="visible-pick-actions">{graded ? <span className={`badge pick-result-${pick.result}`}>{resultLabel}</span> : !locked && <span className="badge open">editable</span>}</div></div>;
}
