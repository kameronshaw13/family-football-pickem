"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronRight, CircleCheckBig, CircleDollarSign, EyeOff, Landmark, Lock, RefreshCw, Save, Send, Shield, Trophy, WalletCards, X, Zap } from "lucide-react";
import type { BankEntry, BankSettings, Game, Pick, PickType, Profile, SideBet, Standing, WeekRule } from "@/lib/types";
import { normalizeSpreadForSelectedTeam, spreadText, underdogWinValue } from "@/lib/spreads";
import { countRegularByLeague, getWeekRule } from "@/lib/weekRules";
import { computeWeeklyStandings } from "@/lib/weeklyBank";
import { hasChargers, isChargersTeam } from "@/lib/seasonRules";

type Tab = "picks" | "card" | "standings" | "rules";
type PicksView = "board" | "sideBets";
type CardView = "mine" | "group";
type StandingsView = "standings" | "bank";
type BetView = "new" | "received" | "sent";
type Filter = "CFB" | "NFL" | "DOGS" | "PAST";
type Toast = { message: string; tone: "success" | "error" | "info" } | null;

type AppData = {
  currentUser: Profile;
  profiles: Profile[];
  games: Game[];
  picks: Pick[];
  standings: Standing[];
  bankSettings: BankSettings;
  bankEntries: BankEntry[];
  sideBets: SideBet[];
  sideBetBankTotals: Record<string, number>;
  week: number;
  weekRule: WeekRule;
  weekOpenTime: string | null;
  availableWeeks: number[];
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

function dt(iso: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }).format(new Date(iso));
}
function shortDt(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }).format(new Date(iso));
}
function closeText(iso: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }).format(new Date(iso));
}
function timeText(iso: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }).format(new Date(iso));
}
function gameDayKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Chicago" }).format(new Date(iso));
}
function gameDayLabel(iso: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "America/Chicago" }).format(new Date(iso)).toUpperCase();
}
function lockText(iso: string) {
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "America/Chicago" }).format(new Date(iso)).toUpperCase();
  const labels: Record<string, string> = { TUESDAY: "TUES", WEDNESDAY: "WEDS", THURSDAY: "THURS" };
  return `${labels[weekday] || weekday.slice(0, 3)} ${timeText(iso)}`;
}
function spreadForTeam(game: Game, team: string) {
  return spreadText(normalizeSpreadForSelectedTeam(team, game.current_spread_team, game.current_spread));
}
function isClosed(game: Game) {
  return game.is_locked || new Date(game.lock_time) <= new Date();
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
function pctText(value: number) {
  return value ? value.toFixed(3).replace(/^0/, "") : "—";
}
export default function PickemApp() {
  const [tab, setTab] = useState<Tab>("picks");
  const [picksView, setPicksView] = useState<PicksView>("board");
  const [cardView, setCardView] = useState<CardView>("mine");
  const [standingsView, setStandingsView] = useState<StandingsView>("standings");
  const [betView, setBetView] = useState<BetView>("received");
  const [filter, setFilter] = useState<Filter>("CFB");
  const [data, setData] = useState<AppData | null>(null);
  const [week, setWeek] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [savingBank, setSavingBank] = useState(false);
  const [savingPicks, setSavingPicks] = useState(false);
  const [savingBet, setSavingBet] = useState(false);
  const [refreshingOdds, setRefreshingOdds] = useState(false);
  const [stagedPicks, setStagedPicks] = useState<Pick[] | null>(null);
  const [, setClock] = useState(() => Date.now());
  const [betGameId, setBetGameId] = useState("");
  const [betCreatorTeam, setBetCreatorTeam] = useState("");
  const [betAmount, setBetAmount] = useState("20");
  const [betRecipients, setBetRecipients] = useState<string[]>([]);
  const [toast, setToast] = useState<Toast>(null);
  const [pastDayState, setPastDayState] = useState<Record<string, boolean>>({});

  async function load(nextWeek = week) {
    setLoading(true);
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
      setMessage(payload.error || "Could not load app data.");
      setLoading(false);
      return;
    }
    setData(payload);
    setWeek(payload.week);
    setLoading(false);
  }

  useEffect(() => { load(null); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function notify(message: string, tone: NonNullable<Toast>["tone"] = "info") {
    setToast({ message, tone });
  }

  async function savePicks(card: Pick[]) {
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) {
      window.location.href = "/login";
      return false;
    }
    setSavingPicks(true);
    const response = await fetch("/api/picks", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "saveCard", week: data?.week, picks: card.map((pick) => ({ gameId: pick.game_id, selectedTeam: pick.selected_team, pickType: pick.pick_type })) })
    });
    const payload = await response.json();
    setSavingPicks(false);
    if (!response.ok) {
      notify(payload.error || "Picks could not be saved.", "error");
      return false;
    }
    setStagedPicks(null);
    await load(week);
    notify("Picks saved. They remain editable until each game locks.", "success");
    return true;
  }

  async function refreshOdds() {
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) return;
    setRefreshingOdds(true);
    const response = await fetch("/api/cron/odds", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    const payload = await response.json();
    setRefreshingOdds(false);
    if (!response.ok) {
      notify(payload.error || "Odds refresh failed.", "error");
      return;
    }
    await load(week);
    notify(`Odds refreshed for ${payload.gamesUpdated || 0} games.`, "success");
  }

  async function postBank(body: any) {
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) {
      window.location.href = "/login";
      return false;
    }
    setSavingBank(true);
    const response = await fetch("/api/bank", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    const payload = await response.json();
    setSavingBank(false);
    if (!response.ok) {
      notify(payload.error || "Bank update failed.", "error");
      return false;
    }
    await load(week);
    notify("Bank updated.", "success");
    return true;
  }

  async function postSideBet(body: any) {
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) {
      window.location.href = "/login";
      return false;
    }
    setSavingBet(true);
    const response = await fetch("/api/side-bets", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    const payload = await response.json();
    setSavingBet(false);
    if (!response.ok) {
      notify(payload.error || "Side bet action failed.", "error");
      return false;
    }
    await load(week);
    return true;
  }

  if (loading) return <LoadingShell />;
  if (!data) return <div className="app-shell"><main className="container"><div className="error-card">{message || "Could not load app."}</div></main></div>;

  const { currentUser, games, picks, profiles, standings, availableWeeks, bankEntries } = data;
  const sideBets = data.sideBets || [];
  const rule = data.weekRule || getWeekRule(data.week);
  const myPicks = picks.filter((p) => p.user_id === currentUser.id && p.week === data.week);
  const cardPicks = stagedPicks || myPicks;
  const myRegular = cardPicks.filter((p) => p.pick_type === "regular");
  const myUnderdog = cardPicks.find((p) => p.pick_type === "underdog");
  const regularCounts = countRegularByLeague(cardPicks, games);
  const weeklyStandings = computeWeeklyStandings(profiles, picks);
  const weekSettlements = bankEntries.filter((entry) => entry.week === data.week);
  const weekSettled = weekSettlements.length === profiles.length && profiles.length > 0;
  const weekIsOpen = !data.weekOpenTime || new Date(data.weekOpenTime) <= new Date();
  const incomingOffers = sideBets.filter((bet) => bet.creator_id !== currentUser.id && bet.targets?.some((target) => target.recipient_id === currentUser.id));
  const pendingOfferCount = incomingOffers.filter((bet) => bet.status === "open" && bet.targets?.some((target) => target.recipient_id === currentUser.id && target.response === "pending")).length;
  const bankTotals = profiles.map((profile) => ({
    id: profile.id,
    display_name: profile.display_name,
    total: bankEntries.filter((entry) => entry.user_id === profile.id).reduce((sum, entry) => sum + Number(entry.amount || 0), 0) + Number(data.sideBetBankTotals?.[profile.id] || 0)
  })).sort((a, b) => b.total - a.total);
  const openBetGames = games.filter((game) => !hasChargers(game) && new Date(game.commence_time) > new Date() && game.current_spread != null && game.current_spread_team);
  const selectedBetGame = openBetGames.find((game) => game.id === betGameId) || openBetGames[0];
  const selectedCreatorTeam = selectedBetGame && [selectedBetGame.away_team, selectedBetGame.home_team].includes(betCreatorTeam) ? betCreatorTeam : selectedBetGame?.away_team || "";

  const filteredGames = games.filter((g) => {
    const past = isClosed(g) || g.final_home_score != null || g.final_away_score != null;
    if (filter === "PAST") return past;
    if (past) return false;
    if (filter === "CFB") return g.league === "CFB";
    if (filter === "NFL") return g.league === "NFL";
    return [g.away_team, g.home_team].some((team) => !isChargersTeam(team) && teamDogValue(g, team) > 0);
  });
  const gameGroups = filteredGames.reduce<Array<{ key: string; label: string; games: Game[] }>>((groups, game) => {
    const key = gameDayKey(game.commence_time);
    const existingGroup = groups[groups.length - 1];
    if (existingGroup?.key === key) existingGroup.games.push(game);
    else groups.push({ key, label: gameDayLabel(game.commence_time), games: [game] });
    return groups;
  }, []);
  function addPick(game: Game, team: string, pickType: PickType) {
    if (hasChargers(game)) {
      notify("Los Angeles Chargers games are not available in this league.", "error");
      return;
    }
    const existing = cardPicks.find((pick) => pick.game_id === game.id);
    if (existing?.status === "locked") return;
    if (existing && existing.pick_type !== pickType) {
      notify("Remove this game from My Card before switching between spread and dog.", "error");
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
    setStagedPicks(nextCard);
  }

  function removePick(pick: Pick) {
    if (pick.status === "locked") return;
    const game = games.find((item) => item.id === pick.game_id) || pick.game;
    if (game && isClosed(game)) {
      notify("This pick has reached its lock time and is final.", "error");
      return;
    }
    setStagedPicks(cardPicks.filter((item) => item.game_id !== pick.game_id));
  }

  function toggleBetRecipient(profileId: string) {
    setBetRecipients((current) => current.includes(profileId) ? current.filter((id) => id !== profileId) : [...current, profileId]);
  }

  async function createSideBet() {
    if (!selectedBetGame || !selectedCreatorTeam || !betRecipients.length) return;
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
          <strong className="brand-title">Shaw Family Pick'em</strong>
        </div>
        {availableWeeks.length > 0 && <div className="header-slate"><div className="week-select-wrap"><select aria-label="Select week" value={data.week} onChange={(e) => { setStagedPicks(null); load(Number(e.target.value)); }} className="week-select">
          {availableWeeks.map((w) => <option key={w} value={w}>{w === 0 ? "Week 0" : `Week ${w}`}</option>)}
        </select><ChevronDown size={14} /></div></div>}
      </div>
    </header>

    <nav className="primary-nav">
      <div className="primary-nav-inner">
        {primaryNav.map((item) => <button key={item.id} aria-current={tab === item.id ? "page" : undefined} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><span className="nav-icon"><item.icon size={19} />{item.id === "picks" && pendingOfferCount > 0 && <b>{pendingOfferCount}</b>}</span><span>{item.label}</span></button>)}
      </div>
    </nav>

    <main className="container">
      {message && <div className="error-card">{message}</div>}

      {tab === "picks" && <section className="panel picks-panel">
        {!weekIsOpen && data.weekOpenTime && <div className="notice-card">This week opens for picks on {closeText(data.weekOpenTime)} CT.</div>}
        <SectionTabs items={[{ id: "board", label: "Pick Board" }, { id: "sideBets", label: `Side Bets${pendingOfferCount ? ` (${pendingOfferCount})` : ""}` }]} value={picksView} onChange={(value) => setPicksView(value as PicksView)} />
        {picksView === "board" && <>
          <div className="view-select-row"><div className="compact-select"><select aria-label="Choose pick board category" value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>{(["CFB", "NFL", "DOGS", "PAST"] as Filter[]).map((option) => <option key={option} value={option}>{option}</option>)}</select><ChevronDown size={15} /></div></div>
          {filteredGames.length === 0 && <div className="empty-state">{filter === "PAST" ? "No past games this week." : `No open ${filter} games right now.`}</div>}
          <div className="game-days">
            {gameGroups.map((group, index) => {
              const pastGroupOpen = pastDayState[group.key] ?? index === gameGroups.length - 1;
              return <div className={`game-day-group ${filter === "PAST" ? "past-day-group" : ""}`} key={group.key}>
                {filter === "PAST" ? <button className="game-day-marker game-day-toggle" aria-expanded={pastGroupOpen} onClick={() => setPastDayState((current) => ({ ...current, [group.key]: !pastGroupOpen }))}><strong>{group.label}</strong><span /><small>{group.games.length} game{group.games.length === 1 ? "" : "s"}</small><ChevronDown className={pastGroupOpen ? "open" : ""} size={16} /></button> : <div className="game-day-marker"><strong>{group.label}</strong><span /></div>}
                {(filter !== "PAST" || pastGroupOpen) && <div className="game-list">{group.games.map((game) => <GameCard key={game.id} game={game} picks={cardPicks} filter={filter} weekIsOpen={weekIsOpen} addPick={addPick} />)}</div>}
              </div>;
            })}
          </div>
        </>}
        {picksView === "sideBets" && <SideBetCenter
          view={betView}
          setView={setBetView}
          currentUser={currentUser}
          profiles={profiles}
          sideBets={sideBets}
          openGames={openBetGames}
          selectedGame={selectedBetGame}
          selectedCreatorTeam={selectedCreatorTeam}
          amount={betAmount}
          recipients={betRecipients}
          saving={savingBet}
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
          <CardProgress rule={rule} counts={regularCounts} hasDog={Boolean(myUnderdog)} dirty={stagedPicks !== null} />
          <div className={`card-save-bar ${stagedPicks ? "dirty" : ""}`}><div><strong>{stagedPicks ? "Unsaved changes" : "Picks saved"}</strong><p>Saved picks stay editable until their listed lock time.</p></div>{!stagedPicks && <CircleCheckBig size={19} />}</div>
          <PickList picks={myRegular} games={games} title="Spread picks" removePick={removePick} />
          <PickList picks={myUnderdog ? [myUnderdog] : []} games={games} title="Underdog pick" removePick={removePick} />
        </>}
        {cardView === "group" && <div className="group-list">
          {profiles.map((profile) => <div key={profile.id} className="group-card">
            <h3><EyeOff size={15} /> {profile.display_name}</h3>
            {picks.filter((p) => p.user_id === profile.id).length === 0 && <p className="muted">No visible picks yet.</p>}
            {picks.filter((p) => p.user_id === profile.id).map((pick) => <VisiblePick key={pick.id} pick={pick} games={games} />)}
          </div>)}
        </div>}
      </section>}

      {tab === "standings" && <section className="panel standings-panel">
        <SectionTabs items={[{ id: "standings", label: "Standings" }, { id: "bank", label: "Bank" }]} value={standingsView} onChange={(value) => setStandingsView(value as StandingsView)} />
        {standingsView === "standings" && <>
          <div className="section-title standings-title"><Trophy size={19} /><div><h2>Season standings</h2><p>Ranked by win percentage, then wins.</p></div></div>
          <Leaderboard rows={standings} />
          <div className="subsection weekly-standings"><h3>This week</h3><Leaderboard rows={weeklyStandings} /></div>
        </>}
        {standingsView === "bank" && <>
          <div className="section-title"><Landmark size={19} /><div><h2>Bank</h2><p>Weekly results and settled side bets.</p></div></div>
          <div className="bank-summary-grid">
            {bankTotals.map((row) => <div key={row.id} className="money-card"><span>{row.display_name}</span><strong className={row.total > 0 ? "money-pos" : row.total < 0 ? "money-neg" : ""}>{money(row.total)}</strong></div>)}
          </div>
          <div className="subsection">
            <h3>This week</h3>
            <div className="weekly-bank-status"><div><strong>{weekSettled ? "Week settled" : "Awaiting final results"}</strong><p>{rule.perfectBonus ? "Normal pool $30 · perfect winner $60" : "Standard pool · $30"}</p></div>{currentUser.is_admin && <button className="btn accent" disabled={savingBank} onClick={() => postBank({ action: "settleWeek", week: data.week })}>{savingBank ? "Working…" : weekSettled ? "Re-settle" : "Settle week"}</button>}</div>
          </div>
          <div className="subsection"><h3>Weekly ledger</h3><div className="ledger-list">{bankEntries.length === 0 && <p className="muted">No weekly entries yet.</p>}{bankEntries.map((entry) => <div key={entry.id} className="ledger-row"><div><strong>Week {entry.week} · {entry.profile?.display_name || profiles.find((p) => p.id === entry.user_id)?.display_name || "User"}</strong><p>{entry.note || "Bank entry"}</p></div><strong className={Number(entry.amount) > 0 ? "money-pos" : Number(entry.amount) < 0 ? "money-neg" : ""}>{money(Number(entry.amount))}</strong></div>)}</div></div>
          <div className="subsection"><h3>Side bet ledger</h3><div className="ledger-list">{sideBets.filter((bet) => bet.status === "settled").length === 0 && <p className="muted">No settled side bets yet.</p>}{sideBets.filter((bet) => bet.status === "settled").map((bet) => <SideBetLedgerRow key={bet.id} bet={bet} currentUser={currentUser} />)}</div></div>
        </>}
      </section>}

      {tab === "rules" && <section className="panel rules-panel">
        <div className="section-title"><Shield size={19} /><div><h2>League rules</h2></div></div>
        <div className="rules-list">
          <RuleItem icon={WalletCards} title="Weekly card"><span>Week 1: 3 CFB + dog.</span><span>Week 2: 5 CFB + dog.</span><span>Mixed weeks: 5 picks with at least 1 CFB and 1 NFL + dog.</span><span>After CFB: 2 NFL + dog.</span></RuleItem>
          <RuleItem icon={Shield} title="Eligible games">Regular season only. Bowls, CFP, NFL playoffs, and every Chargers game are excluded.</RuleItem>
          <RuleItem icon={Zap} title="Underdog">+7 to +9.5 = +1W, +10 to +19.5 = +2W, and +20 or more = +3W. The dog must win outright.</RuleItem>
          <RuleItem icon={Trophy} title="Standings">The season winner receives $300. Winner is based on win percentage, then total wins.</RuleItem>
          <RuleItem icon={CircleDollarSign} title="Weekly bank">Last pays $20 and second pays $10 to first. Tied last pays $15 each; tied first splits $20; a three-way tie pays $0.</RuleItem>
          <RuleItem icon={Trophy} title="Perfect week">Five-pick weeks only. A perfect week doubles all payments.</RuleItem>
          <RuleItem icon={Lock} title="Pick locks">Saved picks stay editable. Tue-Fri games lock 24 hours before kickoff; Sat-Mon games lock Friday at 5 PM CT.</RuleItem>
          <RuleItem icon={Send} title="Side bets">Spread only. Offers must be accepted before kickoff and settle directly into the bank.</RuleItem>
        </div>
        {currentUser.is_admin && <div className="admin-action"><button className="btn secondary" disabled={refreshingOdds} onClick={refreshOdds}><RefreshCw size={15} /> {refreshingOdds ? "Refreshing odds…" : "Refresh odds now"}</button></div>}
      </section>}
    </main>
    {tab === "picks" && stagedPicks !== null && <button className="floating-review" onClick={() => { setTab("card"); setCardView("mine"); }}>
      <span><b>Unsaved picks</b><small>Review your card before games lock</small></span>
      <strong>Review & save <ChevronRight size={17} /></strong>
    </button>}
    {tab === "card" && cardView === "mine" && stagedPicks !== null && <button className="sticky-card-save" disabled={savingPicks} onClick={() => savePicks(cardPicks)}><Save size={17} /> {savingPicks ? "Saving picks…" : "Save picks"}</button>}
    {toast && <div className={`toast ${toast.tone}`} role="status" aria-live="polite">{toast.tone === "success" && <CircleCheckBig size={18} />}{toast.tone === "error" && <X size={18} />}<span>{toast.message}</span></div>}
  </div>;
}

function SectionTabs({ items, value, onChange }: { items: Array<{ id: string; label: string }>; value: string; onChange: (value: string) => void }) {
  return <div className="section-tabs">{items.map((item) => <button key={item.id} className={value === item.id ? "active" : ""} onClick={() => onChange(item.id)}>{item.label}</button>)}</div>;
}

function Leaderboard({ rows }: { rows: Array<Standing & { rank?: number }> }) {
  function rankFor(index: number) {
    if (rows[index].rank) return rows[index].rank;
    const firstMatch = rows.findIndex((row) => row.win_pct === rows[index].win_pct && row.wins === rows[index].wins);
    return firstMatch + 1;
  }

  return <div className="leaderboard">
    <div className="leaderboard-labels"><span>Rank</span><span>Player</span><span>Win %</span></div>
    {rows.map((row, index) => <div className="leaderboard-row" key={row.user_id}>
      <span className={`leaderboard-rank rank-${rankFor(index)}`}>{rankFor(index)}</span>
      <div className="leaderboard-player"><strong>{row.display_name}</strong><span>{row.wins}-{row.losses}-{row.pushes}</span></div>
      <strong className="leaderboard-pct">{pctText(row.win_pct)}</strong>
    </div>)}
  </div>;
}

function RuleItem({ icon: Icon, title, children }: { icon: typeof Trophy; title: string; children: React.ReactNode }) {
  return <details className="rule-item">
    <summary><span className="rule-icon"><Icon size={19} /></span><strong>{title}</strong><ChevronDown className="rule-chevron" size={17} /></summary>
    <div className="rule-copy">{children}</div>
  </details>;
}

function LoadingShell() {
  return <div className="app-shell loading-shell">
    <header className="scoreboard-header"><div className="scoreboard-main"><strong className="brand-title">Shaw Family Pick'em</strong><div className="skeleton skeleton-week" /></div></header>
    <main className="container">
      <div className="skeleton skeleton-tabs" />
      <div className="skeleton skeleton-filters" />
      <div className="skeleton skeleton-day" />
      {[0, 1, 2].map((item) => <div className="skeleton-game" key={item}><div className="skeleton skeleton-meta" /><div className="skeleton skeleton-team" /><div className="skeleton skeleton-team" /></div>)}
    </main>
    <nav className="primary-nav"><div className="primary-nav-inner">{[Zap, WalletCards, Trophy, Shield].map((Icon, index) => <span className="loading-nav-item" key={index}><Icon size={19} /><i /></span>)}</div></nav>
  </div>;
}

function SideBetCenter({ view, setView, currentUser, profiles, sideBets, openGames, selectedGame, selectedCreatorTeam, amount, recipients, saving, setGame, setCreatorTeam, setAmount, toggleRecipient, createBet, respond }: {
  view: BetView;
  setView: (value: BetView) => void;
  currentUser: Profile;
  profiles: Profile[];
  sideBets: SideBet[];
  openGames: Game[];
  selectedGame?: Game;
  selectedCreatorTeam: string;
  amount: string;
  recipients: string[];
  saving: boolean;
  setGame: (value: string) => void;
  setCreatorTeam: (value: string) => void;
  setAmount: (value: string) => void;
  toggleRecipient: (value: string) => void;
  createBet: () => void;
  respond: (action: "accept" | "decline" | "cancel", sideBetId: string) => Promise<boolean>;
}) {
  const [confirmingBetId, setConfirmingBetId] = useState<string | null>(null);
  const received = sideBets.filter((bet) => bet.creator_id !== currentUser.id && bet.targets?.some((target) => target.recipient_id === currentUser.id));
  const sent = sideBets.filter((bet) => bet.creator_id === currentUser.id);
  const otherPlayers = profiles.filter((profile) => profile.id !== currentUser.id);
  const offeredTeam = selectedGame ? (selectedCreatorTeam === selectedGame.home_team ? selectedGame.away_team : selectedGame.home_team) : "";
  const creatorSpread = selectedGame ? normalizeSpreadForSelectedTeam(selectedCreatorTeam, selectedGame.current_spread_team, selectedGame.current_spread) : null;
  const confirmingBet = received.find((bet) => bet.id === confirmingBetId);

  async function acceptConfirmedBet() {
    if (!confirmingBetId) return;
    const accepted = await respond("accept", confirmingBetId);
    if (accepted) setConfirmingBetId(null);
  }

  return <div className="side-bet-center">
    <div className="view-select-row"><div className="compact-select"><select aria-label="Choose side bet view" value={view} onChange={(event) => setView(event.target.value as BetView)}><option value="received">For You</option><option value="sent">Sent</option><option value="new">Make Offer</option></select><ChevronDown size={15} /></div></div>

    {view === "new" && <div className="bet-composer">
      <div className="section-title"><Send size={19} /><div><h2>Make an offer</h2><p>Spread only · line locks when sent</p></div></div>
      {openGames.length === 0 && <div className="empty-state">No games with an open spread are available.</div>}
      {selectedGame && <div className="offer-flow">
        <div className="offer-step"><span className="step-number">1</span><div className="step-content">
          <label className="field-label" htmlFor="side-bet-game">Choose a game</label>
          <select id="side-bet-game" className="input" value={selectedGame.id} onChange={(event) => setGame(event.target.value)}>
            {openGames.map((game) => <option key={game.id} value={game.id}>{dt(game.commence_time)} · {displayTeamName(game, game.away_team)} at {displayTeamName(game, game.home_team)}</option>)}
          </select>
        </div></div>

        <div className="offer-step"><span className="step-number">2</span><div className="step-content">
          <span className="field-label">Choose your side</span>
          <div className="offer-team-select">
            {[selectedGame.away_team, selectedGame.home_team].map((team) => <button key={team} className={selectedCreatorTeam === team ? "active" : ""} onClick={() => setCreatorTeam(team)}>
              <TeamLogo url={logoForTeam(selectedGame, team)} name={team} />
              <span>{displayTeamName(selectedGame, team)}</span>
              <strong>{spreadForTeam(selectedGame, team)}</strong>
            </button>)}
          </div>
        </div></div>

        <div className="offer-step"><span className="step-number">3</span><div className="step-content offer-fields">
          <label><span className="field-label">Amount</span><div className="money-input"><b>$</b><input aria-label="Side bet amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></div></label>
          <fieldset><legend className="field-label">Send to</legend><div className="recipient-grid">{otherPlayers.map((profile) => <label key={profile.id} className={recipients.includes(profile.id) ? "checked" : ""}><input type="checkbox" checked={recipients.includes(profile.id)} onChange={() => toggleRecipient(profile.id)} /><span>{profile.display_name}</span></label>)}</div></fieldset>
        </div></div>

        <div className="offer-review"><span>Offer review</span><div className="bet-preview">
          <div><span>You keep</span><strong>{displayTeamName(selectedGame, selectedCreatorTeam)} {spreadText(creatorSpread)}</strong></div>
          <div><span>They get</span><strong>{displayTeamName(selectedGame, offeredTeam)} {spreadText(creatorSpread == null ? null : -creatorSpread)}</strong></div>
        </div></div>
        <button className="btn accent full" disabled={saving || Number(amount) <= 0 || !recipients.length} onClick={createBet}><Send size={15} /> {saving ? "Sending…" : "Send offer"}</button>
      </div>}
    </div>}

    {view === "received" && <SideBetList bets={received} mode="received" currentUser={currentUser} empty="No offers sent to you yet." saving={saving} requestAccept={setConfirmingBetId} respond={respond} />}
    {view === "sent" && <SideBetList bets={sent} mode="sent" currentUser={currentUser} empty="You have not sent any offers yet." saving={saving} requestAccept={setConfirmingBetId} respond={respond} />}

    {confirmingBet && <div className="confirmation-backdrop">
      <section className="confirmation-sheet" role="dialog" aria-modal="true" aria-labelledby="accept-bet-title">
        <div className="confirmation-icon"><CircleDollarSign size={22} /></div>
        <div className="confirmation-heading"><span>Review side bet</span><h2 id="accept-bet-title">Accept {stakeMoney(Number(confirmingBet.amount))} bet?</h2></div>
        <div className="confirmation-matchup">
          <div><span>You take</span><strong>{confirmingBet.game ? displayTeamName(confirmingBet.game, confirmingBet.offered_team) : confirmingBet.offered_team} {spreadText(Number(confirmingBet.offered_spread))}</strong></div>
          <div><span>{confirmingBet.creator?.display_name || "Opponent"} keeps</span><strong>{confirmingBet.game ? displayTeamName(confirmingBet.game, confirmingBet.creator_team) : confirmingBet.creator_team} {spreadText(Number(confirmingBet.creator_spread))}</strong></div>
        </div>
        {confirmingBet.game && <p className="confirmation-kickoff">Kickoff {dt(confirmingBet.game.commence_time)}</p>}
        <div className="confirmation-actions"><button className="btn secondary" disabled={saving} onClick={() => setConfirmingBetId(null)}>Cancel</button><button className="btn accept" disabled={saving} onClick={acceptConfirmedBet}><Check size={16} /> {saving ? "Accepting…" : "Accept bet"}</button></div>
      </section>
    </div>}
  </div>;
}

function SideBetList({ bets, mode, currentUser, empty, saving, requestAccept, respond }: { bets: SideBet[]; mode: "received" | "sent"; currentUser: Profile; empty: string; saving: boolean; requestAccept: (sideBetId: string) => void; respond: (action: "accept" | "decline" | "cancel", sideBetId: string) => Promise<boolean> }) {
  const sorted = [...bets].sort((a, b) => Number(b.status === "open") - Number(a.status === "open") || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return <div className="side-bet-list">{!sorted.length && <div className="empty-state">{empty}</div>}{sorted.map((bet) => <SideBetCard key={bet.id} bet={bet} mode={mode} currentUser={currentUser} saving={saving} requestAccept={requestAccept} respond={respond} />)}</div>;
}

function SideBetCard({ bet, mode, currentUser, saving, requestAccept, respond }: { bet: SideBet; mode: "received" | "sent"; currentUser: Profile; saving: boolean; requestAccept: (sideBetId: string) => void; respond: (action: "accept" | "decline" | "cancel", sideBetId: string) => Promise<boolean> }) {
  const game = bet.game;
  const creatorName = bet.creator?.display_name || "A player";
  const target = bet.targets?.find((row) => row.recipient_id === currentUser.id);
  const targetNames = bet.targets?.map((row) => row.recipient?.display_name).filter(Boolean).join(" or ") || "player";
  const offerOpen = bet.status === "open" && target?.response === "pending" && Boolean(game && new Date(game.commence_time) > new Date());
  const status = bet.status === "open" && target?.response === "declined" ? "declined" : bet.status;
  const offeredName = game ? displayTeamName(game, bet.offered_team) : bet.offered_team;
  const creatorTeamName = game ? displayTeamName(game, bet.creator_team) : bet.creator_team;

  return <article className={`side-bet-card ${offerOpen ? "open" : ""}`}>
    <div className="side-bet-head"><span className={`status-mark ${status}`}>{status}</span><strong>{stakeMoney(Number(bet.amount))}</strong></div>
    <p className="offer-statement">{mode === "received" ? `${creatorName} offered you ${offeredName} ${spreadText(Number(bet.offered_spread))} vs ${creatorTeamName}.` : `You offered ${targetNames} ${offeredName} ${spreadText(Number(bet.offered_spread))} vs ${creatorTeamName}.`}</p>
    <div className="bet-line-summary"><span>{creatorName} has <strong>{creatorTeamName} {spreadText(Number(bet.creator_spread))}</strong></span><span>{bet.accepted_by_profile ? `Accepted by ${bet.accepted_by_profile.display_name}` : game ? `Kickoff ${dt(game.commence_time)}` : ""}</span></div>
    {bet.status === "settled" && <div className="bet-result">{bet.result === "push" ? "Push · no bank change" : `${bet.winner_id === currentUser.id ? "You won" : bet.winner_id === bet.creator_id ? `${creatorName} won` : `${bet.accepted_by_profile?.display_name || "Opponent"} won`} ${stakeMoney(Number(bet.amount))}`}</div>}
    {mode === "received" && offerOpen && <div className="actions"><button className="btn accept" disabled={saving} onClick={() => requestAccept(bet.id)}><Check size={15} /> Review & accept</button><button className="btn secondary" disabled={saving} onClick={() => respond("decline", bet.id)}><X size={15} /> Decline</button></div>}
    {mode === "sent" && bet.status === "open" && <div className="actions"><button className="btn secondary" disabled={saving} onClick={() => respond("cancel", bet.id)}><X size={15} /> Cancel offer</button></div>}
  </article>;
}

function SideBetLedgerRow({ bet, currentUser }: { bet: SideBet; currentUser: Profile }) {
  const participant = bet.creator_id === currentUser.id || bet.accepted_by === currentUser.id;
  const delta = bet.result === "push" || !participant ? 0 : bet.winner_id === currentUser.id ? Number(bet.amount) : -Number(bet.amount);
  return <div className="ledger-row"><div><strong>{bet.game ? `${displayTeamName(bet.game, bet.offered_team)} ${spreadText(Number(bet.offered_spread))}` : "Side bet"}</strong><p>{bet.creator?.display_name} vs {bet.accepted_by_profile?.display_name} · {bet.result.replaceAll("_", " ")}</p></div>{participant && <strong className={delta > 0 ? "money-pos" : delta < 0 ? "money-neg" : ""}>{money(delta)}</strong>}</div>;
}

function GameCard({ game, picks, filter, weekIsOpen, addPick }: { game: Game; picks: Pick[]; filter: Filter; weekIsOpen: boolean; addPick: (game: Game, team: string, pickType: PickType) => void }) {
  const closed = isClosed(game) || !weekIsOpen;
  const hasFinalScore = game.final_away_score != null && game.final_home_score != null;
  const existing = picks.find((p) => p.game_id === game.id);
  const canChangeExisting = existing?.status === "draft" && existing.pick_type === (filter === "DOGS" ? "underdog" : "regular");
  const selectType: PickType = filter === "DOGS" ? "underdog" : "regular";
  const awayDogValue = teamDogValue(game, game.away_team);
  const homeDogValue = teamDogValue(game, game.home_team);

  function sideLine(team: string) {
    if (filter === "PAST" && hasFinalScore) return String(team === game.away_team ? game.final_away_score : game.final_home_score);
    if (filter === "DOGS") return dogLineText(game, team);
    return spreadForTeam(game, team);
  }

  function sideIsSelectable(team: string) {
    if (closed) return false;
    if (isChargersTeam(team)) return false;
    if (existing && !canChangeExisting) return false;
    if (filter === "DOGS") return teamDogValue(game, team) > 0;
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
  const awayOpponentOnly = filter === "DOGS" && awayDogValue === 0;
  const homeOpponentOnly = filter === "DOGS" && homeDogValue === 0;

  return <article className={`game-card matchup-card ${closed ? "closed" : ""} ${existing ? "selected" : ""}`}>
    <div className="game-head compact-game-head">
      <div className="game-time-group"><span className="game-time">{timeText(game.commence_time)}</span>{hasFinalScore && <span className="badge final">Final</span>}{existing && <span className="badge picked">{existing.pick_type === "underdog" ? "dog" : "spread"}</span>}</div>
      {filter !== "PAST" && <div className="kick">Closes {lockText(game.lock_time)}</div>}
    </div>

    <div className="stacked-matchup" role="group" aria-label={`${displayTeamName(game, game.away_team)} at ${displayTeamName(game, game.home_team)}`}>
      <button
        type="button"
        className={`team-row away-row ${awaySelectable ? "selectable" : ""} ${existing?.selected_team === game.away_team ? "picked-side" : ""} ${awayOpponentOnly ? "opponent-only" : ""} ${awayBlocked ? "blocked-side" : ""}`}
        disabled={!awaySelectable}
        onClick={() => choose(game.away_team)}
      >
        <TeamLogo url={logoForTeam(game, game.away_team)} name={game.away_team} />
        <span className="team-name">{displayTeamName(game, game.away_team)}</span>
        {!awayOpponentOnly && <span className={`team-spread ${awayBlocked ? "unavailable" : ""} ${filter === "PAST" && hasFinalScore ? "final-score" : ""}`}><span>{awayBlocked ? "Not eligible" : sideLine(game.away_team)}</span>{existing?.selected_team === game.away_team && <Check className="pick-check" size={15} />}</span>}
      </button>

      <button
        type="button"
        className={`team-row home-row ${homeSelectable ? "selectable" : ""} ${existing?.selected_team === game.home_team ? "picked-side" : ""} ${homeOpponentOnly ? "opponent-only" : ""} ${homeBlocked ? "blocked-side" : ""}`}
        disabled={!homeSelectable}
        onClick={() => choose(game.home_team)}
      >
        <TeamLogo url={logoForTeam(game, game.home_team)} name={game.home_team} />
        <span className="team-name">{displayTeamName(game, game.home_team)}</span>
        {!homeOpponentOnly && <span className={`team-spread ${homeBlocked ? "unavailable" : ""} ${filter === "PAST" && hasFinalScore ? "final-score" : ""}`}><span>{homeBlocked ? "Not eligible" : sideLine(game.home_team)}</span>{existing?.selected_team === game.home_team && <Check className="pick-check" size={15} />}</span>}
      </button>
    </div>
  </article>;
}

function TeamLogo({ url, name }: { url?: string | null; name: string }) {
  if (url) return <img src={url} alt="" className="team-logo" loading="lazy" />;
  return <div className="team-logo fallback">{name.slice(0, 1)}</div>;
}

function CardProgress({ rule, counts, hasDog, dirty }: { rule: WeekRule; counts: { total: number; cfb: number; nfl: number }; hasDog: boolean; dirty: boolean }) {
  const ok = counts.total === rule.regularTotal && counts.cfb >= rule.cfbMinimum && counts.nfl >= rule.nflMinimum && hasDog;
  const completeSlots = Math.min(counts.total + Number(hasDog), rule.regularTotal + 1);
  const progress = completeSlots / (rule.regularTotal + 1) * 100;
  return <div className={`card-progress ${ok ? "complete" : ""} ${dirty ? "dirty" : ""}`}>
    <div className="card-progress-copy"><strong>{ok ? "Card complete" : "Build your card"}</strong><span>{counts.total}/{rule.regularTotal} spreads · {counts.cfb} CFB · {counts.nfl} NFL · dog {hasDog ? "set" : "open"}</span></div>
    <div className="progress-track" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
  </div>;
}

function PickList({ picks, games, title, removePick }: { picks: Pick[]; games: Game[]; title: string; removePick: (p: Pick) => void }) {
  return <div className="pick-section"><h3>{title}</h3>{!picks.length && <p className="muted">None yet.</p>}{picks.map((pick) => {
    const game = games.find((g) => g.id === pick.game_id) || pick.game;
    const final = pick.status === "locked" || Boolean(game && isClosed(game));
    return <div className="pick-card" key={pick.id}>
      <div className="pick-top"><div><p className="pick-title">{game ? displayTeamName(game, pick.selected_team) : pick.selected_team} {pick.pick_type === "underdog" && <span className="dog-tag">Dog +{pick.underdog_win_value || "?"}W</span>}</p><p className="pick-meta">{game ? `${displayTeamName(game, game.away_team)} at ${displayTeamName(game, game.home_team)}` : ""}</p><p className="pick-meta">{pick.status === "locked" ? `Locked ${shortDt(pick.locked_at)} at ${spreadText(pick.locked_spread)}` : final ? "Final · lock time reached" : `${game ? spreadForTeam(game, pick.selected_team) : "Line unavailable"} · locks ${game ? closeText(game.lock_time) : "later"}`}</p></div><div className="pick-row-actions"><span className={`badge ${final ? "locked" : "open"}`}>{final ? "final" : "editable"}</span>{!final && <button className="icon-btn" aria-label={`Remove ${pick.selected_team}`} onClick={() => removePick(pick)}><X size={16} /></button>}</div></div>
    </div>;
  })}</div>;
}

function VisiblePick({ pick, games }: { pick: Pick; games: Game[] }) {
  const game = games.find((g) => g.id === pick.game_id) || pick.game;
  return <div className="visible-pick"><div><strong>{game ? displayTeamName(game, pick.selected_team) : pick.selected_team} {pick.locked_spread != null ? spreadText(pick.locked_spread) : ""}</strong><p>{pick.pick_type === "underdog" ? `Underdog +${pick.underdog_win_value || "?"} wins · must win outright` : "Spread pick"} · locked {shortDt(pick.locked_at)}</p><p>{game ? `${displayTeamName(game, game.away_team)} at ${displayTeamName(game, game.home_team)}` : ""}</p></div><span className="badge">{pick.result}</span></div>;
}
