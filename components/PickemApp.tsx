"use client";

import { useEffect, useState } from "react";
import { CalendarClock, ChevronDown, DollarSign, EyeOff, Landmark, Lock, LogOut, Shield, Trophy, Zap } from "lucide-react";
import type { BankEntry, BankSettings, Game, Pick, PickType, Profile, Standing, WeekRule } from "@/lib/types";
import { normalizeSpreadForSelectedTeam, spreadText, underdogWinValue } from "@/lib/spreads";
import { countRegularByLeague, getWeekRule } from "@/lib/weekRules";

type Tab = "board" | "card" | "group" | "standings" | "bank" | "rules";
type Filter = "ALL" | "CFB" | "NFL" | "DOGS" | "OPEN" | "LOCKED";

type AppData = {
  currentUser: Profile;
  profiles: Profile[];
  games: Game[];
  picks: Pick[];
  standings: Standing[];
  bankSettings: BankSettings;
  bankEntries: BankEntry[];
  week: number;
  weekRule: WeekRule;
  weekOpenTime: string | null;
  availableWeeks: number[];
};

type WeeklyStanding = Standing & { rank: number };

const NFL_NICKNAMES = [
  "49ers", "Bears", "Bengals", "Bills", "Broncos", "Browns", "Buccaneers", "Cardinals", "Chargers", "Chiefs", "Colts", "Commanders", "Cowboys", "Dolphins", "Eagles", "Falcons", "Giants", "Jaguars", "Jets", "Lions", "Packers", "Panthers", "Patriots", "Raiders", "Rams", "Ravens", "Saints", "Seahawks", "Steelers", "Texans", "Titans", "Vikings"
];

const COLLEGE_MASCOTS = [
  "Rainbow Warriors", "Rainbow Wahine", "Blue Raiders", "Green Wave", "Mean Green", "Red Wolves", "Golden Hurricane", "Golden Flashes", "Golden Gophers", "Golden Bears", "Golden Eagles", "Ragin Cajuns", "Ragin' Cajuns", "Thundering Herd", "Fighting Irish", "Fighting Illini", "Black Knights", "Midshipmen", "Gamecocks", "Mountaineers", "Commodores", "Scarlet Knights", "Yellow Jackets", "Boilermakers", "Nittany Lions", "Sun Devils", "Blue Devils", "Demon Deacons", "Crimson Tide", "Horned Frogs", "Red Raiders", "Chanticleers", "Sycamores", "Governors", "Privateers", "Keydets", "Paladins", "Terriers", "Hatters", "Musketeers", "Ramblers", "Explorers", "Billikens", "Jackrabbits", "Leathernecks", "Roadrunners", "Lumberjacks", "Longhorns", "Sooners", "Cyclones", "Buffaloes", "Hurricanes", "Seminoles", "Volunteers", "Razorbacks", "Wolf Pack", "Wolfpack", "RedHawks", "Redhawks", "Jayhawks", "Buckeyes", "Wolverines", "Badgers", "Hawkeyes", "Hoosiers", "Terrapins", "Cornhuskers", "Rainbow Warriors",
  "Flames", "Monarchs", "Miners", "Blazers", "Lobos", "Aztecs", "Bulls", "Zips", "Bobcats", "Rockets", "Broncos", "Chippewas", "Gaels", "Mocs", "Lancers", "Camels", "Seawolves", "Highlanders", "Retrievers", "Pioneers", "Broncs", "Jaspers", "Peacocks", "Salukis", "Flyers", "Penguins", "Vandals", "Mavericks", "Phoenix", "Bison", "Bisons", "Catamounts", "Minutemen", "Jaguars", "Coyotes", "Panthers", "Lions", "Tigers", "Wildcats", "Bulldogs", "Eagles", "Hawks", "Falcons", "Bears", "Bruins", "Rams", "Aggies", "Spartans", "Trojans", "Cardinals", "Pirates", "Knights", "Warriors", "Raiders", "Rebels", "Mustangs", "Owls", "Cougars", "Huskies", "Bearcats", "Bearkats", "Cowboys", "Utes", "Ducks", "Beavers", "Hokies", "Cavaliers", "Gators"
].sort((a, b) => b.length - a.length);

const SCHOOL_SUFFIX_WORDS = new Set(["State", "Tech", "A&M", "International", "Southern", "Northern", "Eastern", "Western", "Central", "Carolina", "Florida", "Georgia", "Texas", "Washington", "Mississippi", "Arizona", "Alabama", "Louisiana", "California", "Colorado", "Dakota", "Mexico", "England", "Orleans", "Monroe", "Lafayette", "Vegas", "Jose", "Diego", "Angeles", "Louis", "Francisco", "Forest", "Green", "Bowling", "Army", "Navy", "Air", "Force", "Notre", "Dame", "Ole", "Miss", "BYU", "TCU", "UAB", "UTEP", "UTSA", "UCF", "USF", "UCLA", "USC", "SMU", "UNLV", "UNM", "LSU", "NC"]);

function displayTeamName(game: Game, team: string) {
  if (game.league === "NFL") {
    const match = NFL_NICKNAMES.find((nickname) => team.toLowerCase().endsWith(nickname.toLowerCase()));
    return match || team.split(/\s+/).slice(-1)[0] || team;
  }

  let cleaned = team
    .replace(/University of/gi, "")
    .replace(/College/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  // Strip mascot/nickname suffixes repeatedly. This catches names like
  // "Liberty Flames", "Old Dominion Monarchs", "NC State Wolfpack", etc.
  let changed = true;
  while (changed) {
    changed = false;
    const lower = cleaned.toLowerCase();
    const mascot = COLLEGE_MASCOTS.find((name) => lower.endsWith(` ${name.toLowerCase()}`));
    if (mascot) {
      cleaned = cleaned.slice(0, cleaned.length - mascot.length).trim();
      changed = true;
    }
  }

  const manualNames: Record<string, string> = {
    "San José State": "San Jose State",
    "San Jose State": "San Jose State",
    "Hawai'i": "Hawaii",
    "Hawaii": "Hawaii",
    "Ole Miss": "Ole Miss",
    "Miami FL": "Miami",
    "Miami Florida": "Miami",
    "NC State": "NC State",
    "N.C. State": "NC State"
  };
  if (manualNames[cleaned]) return manualNames[cleaned];

  const parts = cleaned.split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1];
  if (parts.length >= 3 && last && !SCHOOL_SUFFIX_WORDS.has(last)) {
    cleaned = parts.slice(0, -1).join(" ");
  }

  return cleaned || team;
}

function dogLineText(game: Game, team: string) {
  const spread = normalizeSpreadForSelectedTeam(team, game.current_spread_team, game.current_spread);
  const value = underdogWinValue(spread);
  return `${spreadText(spread)} = +${value}W`;
}

function dt(iso: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }).format(new Date(iso));
}
function shortDt(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }).format(new Date(iso));
}
function closeText(iso: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }).format(new Date(iso));
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
  return `${sign}$${Math.abs(value).toFixed(0)}`;
}
function recordText(line?: Standing) {
  if (!line) return "0-0-0";
  return `${line.wins}-${line.losses}-${line.pushes}`;
}
function pctText(value: number) {
  return value ? value.toFixed(3).replace(/^0/, "") : "—";
}
function computeWeeklyStandings(profiles: Profile[], weekPicks: Pick[]): WeeklyStanding[] {
  const map = new Map<string, WeeklyStanding>();
  for (const profile of profiles) {
    map.set(profile.id, { user_id: profile.id, display_name: profile.display_name, wins: 0, losses: 0, pushes: 0, win_pct: 0, rank: 0 });
  }
  for (const pick of weekPicks) {
    const row = map.get(pick.user_id);
    if (!row || pick.status !== "locked") continue;
    if (pick.result === "win") row.wins += pick.pick_type === "underdog" ? Number(pick.underdog_win_value || 1) : 1;
    if (pick.result === "loss") row.losses += 1;
    if (pick.result === "push") row.pushes += 1;
  }
  const out = Array.from(map.values()).map((row) => ({ ...row, win_pct: row.wins + row.losses === 0 ? 0 : row.wins / (row.wins + row.losses) }));
  out.sort((a, b) => (b.win_pct - a.win_pct) || (b.wins - a.wins) || (a.losses - b.losses) || a.display_name.localeCompare(b.display_name));
  let rank = 1;
  return out.map((row, index) => {
    if (index > 0) {
      const prev = out[index - 1];
      if (!(row.win_pct === prev.win_pct && row.wins === prev.wins && row.losses === prev.losses)) rank = index + 1;
    }
    return { ...row, rank };
  });
}

export default function PickemApp() {
  const [tab, setTab] = useState<Tab>("board");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [data, setData] = useState<AppData | null>(null);
  const [week, setWeek] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [savingBank, setSavingBank] = useState(false);
  const [winnerAmount, setWinnerAmount] = useState("20");
  const [loserAmount, setLoserAmount] = useState("10");

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
    setWinnerAmount(String(payload.bankSettings?.winner_amount ?? 20));
    setLoserAmount(String(payload.bankSettings?.loser_amount ?? 10));
    setWeek(payload.week);
    setLoading(false);
  }

  useEffect(() => { load(null); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function postPick(body: any) {
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) {
      window.location.href = "/login";
      return false;
    }
    const response = await fetch("/api/picks", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) {
      alert(payload.error || "Pick action failed.");
      return false;
    }
    await load(week);
    return true;
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
      alert(payload.error || "Bank update failed.");
      return false;
    }
    await load(week);
    return true;
  }

  function signOut() {
    window.localStorage.removeItem("pickem_session_token");
    window.localStorage.removeItem("pickem_profile");
    window.location.href = "/login";
  }

  if (loading) return <div className="app-shell"><main className="container"><div className="loading-card">Loading pick'em board…</div></main></div>;
  if (!data) return <div className="app-shell"><main className="container"><div className="error-card">{message || "Could not load app."}</div></main></div>;

  const { currentUser, games, picks, profiles, standings, availableWeeks, bankEntries, bankSettings } = data;
  const rule = data.weekRule || getWeekRule(data.week);
  const mySeasonLine = standings.find((s) => s.user_id === currentUser.id);
  const myPicks = picks.filter((p) => p.user_id === currentUser.id && p.week === data.week);
  const myRegular = myPicks.filter((p) => p.pick_type === "regular");
  const myUnderdog = myPicks.find((p) => p.pick_type === "underdog");
  const regularCounts = countRegularByLeague(myPicks, games);
  const weeklyStandings = computeWeeklyStandings(profiles, picks);
  const weekSettlements = bankEntries.filter((entry) => entry.week === data.week);
  const weekSettled = weekSettlements.length === profiles.length && profiles.length > 0;
  const weekIsOpen = !data.weekOpenTime || new Date(data.weekOpenTime) <= new Date();
  const bankTotals = profiles.map((profile) => ({
    id: profile.id,
    display_name: profile.display_name,
    total: bankEntries.filter((entry) => entry.user_id === profile.id).reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
  })).sort((a, b) => b.total - a.total);

  const filteredGames = games.filter((g) => {
    if (filter === "CFB") return g.league === "CFB";
    if (filter === "NFL") return g.league === "NFL";
    if (filter === "OPEN") return !isClosed(g);
    if (filter === "LOCKED") return isClosed(g);
    if (filter === "DOGS") return [g.away_team, g.home_team].some((team) => teamDogValue(g, team) > 0);
    return true;
  });

  function addPick(game: Game, team: string, pickType: PickType) {
    postPick({ action: "draft", gameId: game.id, selectedTeam: team, pickType });
  }

  function lockPick(pick: Pick) {
    postPick({ action: "lock", pickId: pick.id });
  }

  function removePick(pick: Pick) {
    postPick({ action: "remove", pickId: pick.id });
  }

  return <div className="app-shell">
    <header className="scoreboard-header compact-header">
      <div className="scoreboard-main compact-main">
        <div>
          <div className="score-title">{rule.label}</div>
          <div className="score-sub">{currentUser.display_name} · {recordText(mySeasonLine)} · {pctText(mySeasonLine?.win_pct || 0)}</div>
        </div>
        <button className="profile-button" onClick={signOut}><span>{currentUser.display_name}</span><LogOut size={14} /></button>
      </div>
      <div className="week-strip">
        {availableWeeks.length > 0 && <div className="week-select-wrap"><select value={data.week} onChange={(e) => load(Number(e.target.value))} className="week-select">
          {availableWeeks.map((w) => <option key={w} value={w}>{w === 0 ? "Week 0" : `Week ${w}`}</option>)}
        </select><ChevronDown size={14} /></div>}
        <div className="mini-record"><strong>{regularCounts.total}/{rule.regularTotal}</strong> picks · <strong>{myUnderdog ? 1 : 0}/{rule.underdogTotal}</strong> dog</div>
      </div>
    </header>

    <main className="container mobile-container">
      {message && <div className="error-card">{message}</div>}
      {!weekIsOpen && data.weekOpenTime && <div className="notice-card">This week opens for picks on {closeText(data.weekOpenTime)} CT.</div>}

      <nav className="bottom-tabs six-tabs">
        {(["board", "card", "group", "standings", "bank", "rules"] as Tab[]).map((t) => <button key={t} className={`bottom-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t === "card" ? "My Card" : t[0].toUpperCase() + t.slice(1)}</button>)}
      </nav>

      {tab === "board" && <section className="panel board-panel">
        <div className="board-tools compact-tools">
          <div className="filter-row slim">
            {(["ALL", "CFB", "NFL", "DOGS", "OPEN", "LOCKED"] as Filter[]).map((f) => <button key={f} className={`chip ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>{f}</button>)}
          </div>
        </div>
        <div className="game-list">
          {filteredGames.length === 0 && <div className="empty-state">No games loaded for this week yet.</div>}
          {filteredGames.map((game) => <GameCard key={game.id} game={game} picks={myPicks} filter={filter} weekIsOpen={weekIsOpen} addPick={addPick} />)}
        </div>
      </section>}

      {tab === "card" && <section className="panel">
        <div className="panel-head"><div><h2>My Card</h2></div></div>
        <CardProgress rule={rule} counts={regularCounts} hasDog={Boolean(myUnderdog)} />
        <PickList picks={myRegular} games={games} title="Spread picks" lockPick={lockPick} removePick={removePick} />
        <PickList picks={myUnderdog ? [myUnderdog] : []} games={games} title="Underdog pick" lockPick={lockPick} removePick={removePick} />
      </section>}

      {tab === "group" && <section className="panel">
        <div className="panel-head"><div><h2><EyeOff size={18} /> Group Picks</h2></div></div>
        {profiles.map((profile) => <div key={profile.id} className="group-card">
          <h3>{profile.display_name}</h3>
          {picks.filter((p) => p.user_id === profile.id).length === 0 && <p className="muted">No visible picks yet.</p>}
          {picks.filter((p) => p.user_id === profile.id).map((pick) => <VisiblePick key={pick.id} pick={pick} games={games} />)}
        </div>)}
      </section>}

      {tab === "standings" && <section className="panel">
        <div className="panel-head"><div><h2><Trophy size={18} /> Standings</h2></div></div>
        <table className="standings-table"><thead><tr><th>Name</th><th>W</th><th>L</th><th>P</th><th>%</th></tr></thead><tbody>
          {standings.map((s) => <tr key={s.user_id}><td><strong>{s.display_name}</strong></td><td>{s.wins}</td><td>{s.losses}</td><td>{s.pushes}</td><td>{pctText(s.win_pct)}</td></tr>)}
        </tbody></table>
      </section>}

      {tab === "bank" && <section className="panel">
        <div className="panel-head"><div><h2><Landmark size={18} /> Bank</h2></div></div>
        <div className="bank-summary-grid">
          {bankTotals.map((row) => <div key={row.id} className="money-card"><span>{row.display_name}</span><strong className={row.total > 0 ? "money-pos" : row.total < 0 ? "money-neg" : ""}>{money(row.total)}</strong></div>)}
        </div>
        <div className="subsection">
          <h3><DollarSign size={16} /> This week</h3>
          <div className="weekly-bank-status"><div><strong>{weekSettled ? "Week settled" : "Week not settled"}</strong></div>{currentUser.is_admin && <button className="btn gold" disabled={savingBank} onClick={() => postBank({ action: "settleWeek", week: data.week })}>{savingBank ? "Working…" : weekSettled ? "Re-settle" : "Settle"}</button>}</div>
          <table className="standings-table compact"><thead><tr><th>Rank</th><th>Name</th><th>W</th><th>L</th><th>P</th><th>%</th></tr></thead><tbody>{weeklyStandings.map((s) => <tr key={s.user_id}><td>{s.rank}</td><td><strong>{s.display_name}</strong></td><td>{s.wins}</td><td>{s.losses}</td><td>{s.pushes}</td><td>{pctText(s.win_pct)}</td></tr>)}</tbody></table>
        </div>
        {currentUser.is_admin && <div className="subsection bank-settings-panel"><h3><Shield size={16} /> Bank settings</h3><div className="settings-grid"><label><span>Winner gets</span><input className="input" inputMode="decimal" value={winnerAmount} onChange={(e) => setWinnerAmount(e.target.value)} /></label><label><span>Loser pays</span><input className="input" inputMode="decimal" value={loserAmount} onChange={(e) => setLoserAmount(e.target.value)} /></label></div><button className="btn" disabled={savingBank} onClick={() => postBank({ action: "saveSettings", winnerAmount: Number(winnerAmount || bankSettings.winner_amount), loserAmount: Number(loserAmount || bankSettings.loser_amount) })}>{savingBank ? "Saving…" : "Save"}</button></div>}
        <div className="subsection"><h3>Ledger</h3><div className="ledger-list">{bankEntries.length === 0 && <p className="muted">No bank entries yet.</p>}{bankEntries.map((entry) => <div key={entry.id} className="ledger-row"><div><strong>Week {entry.week}</strong><p>{entry.profile?.display_name || profiles.find((p) => p.id === entry.user_id)?.display_name || "User"} · {entry.note || "Bank entry"}</p></div><strong className={Number(entry.amount) > 0 ? "money-pos" : Number(entry.amount) < 0 ? "money-neg" : ""}>{money(Number(entry.amount))}</strong></div>)}</div></div>
      </section>}

      {tab === "rules" && <section className="panel rules-panel">
        <h2>Rules</h2>
        <div className="rule-row"><Shield size={18} /><span>Week 1: 3 college picks plus 1 underdog.</span></div>
        <div className="rule-row"><Shield size={18} /><span>Week 2: 5 college picks plus 1 underdog.</span></div>
        <div className="rule-row"><Shield size={18} /><span>Week 3 and later: 3 college and 2 NFL spread picks, plus 1 underdog.</span></div>
        <div className="rule-row"><Zap size={18} /><span>Underdog: +7 to +9.5 = 1 win, +10 to +19.5 = 2 wins, +20 or more = 3 wins. It must win outright.</span></div>
        <div className="rule-row"><Lock size={18} /><span>No double dipping the same game. Tuesday-Friday games close 24 hours before kickoff. Saturday, Sunday, and Monday games close Friday at 5 PM CT.</span></div>
      </section>}
    </main>
  </div>;
}

function GameCard({ game, picks, filter, weekIsOpen, addPick }: { game: Game; picks: Pick[]; filter: Filter; weekIsOpen: boolean; addPick: (game: Game, team: string, pickType: PickType) => void }) {
  const closed = isClosed(game) || !weekIsOpen;
  const existing = picks.find((p) => p.game_id === game.id);
  const selectType: PickType = filter === "DOGS" ? "underdog" : "regular";
  const allTeams = [game.away_team, game.home_team];
  const dogTeams = allTeams.filter((team) => teamDogValue(game, team) > 0);
  const visibleTeams = filter === "DOGS"
    ? allTeams.filter((team) => dogTeams.includes(team) || dogTeams.some((dog) => dog !== team))
    : allTeams;

  return <article className={`game-card ${closed ? "closed" : ""} ${existing ? "selected" : ""}`}>
    <div className="game-head compact-game-head">
      <div className="badges"><span className="badge">{game.league}</span>{existing && <span className="badge picked">{existing.pick_type === "underdog" ? "dog" : "spread"}</span>}</div>
      <div className="kick"><CalendarClock size={13} /> {dt(game.commence_time)}</div>
    </div>
    <div className="team-stack">
      {visibleTeams.map((team) => {
        const dogValue = teamDogValue(game, team);
        const isDogChoice = filter === "DOGS" && dogValue > 0;
        const isOpponentOnly = filter === "DOGS" && dogValue === 0;
        const disabled = closed || Boolean(existing) || (selectType === "underdog" && dogValue === 0);
        return <div className={`team-select-row ${isOpponentOnly ? "opponent-only" : ""}`} key={team}>
          <div className="team-pill">
            <TeamLogo url={logoForTeam(game, team)} name={team} />
            <div className="team-pill-name">{displayTeamName(game, team)}</div>
            <div className="team-pill-spread">{isOpponentOnly ? "" : isDogChoice ? dogLineText(game, team) : spreadForTeam(game, team)}</div>
          </div>
          {isOpponentOnly
            ? <div className="select-spacer" aria-hidden="true" />
            : <button className="select-btn" disabled={disabled} onClick={() => addPick(game, team, selectType)}>{existing?.selected_team === team ? "Picked" : "Select"}</button>}
        </div>;
      })}
    </div>
    <p className="simple-close">Closes {closeText(game.lock_time)} CT</p>
  </article>;
}

function TeamLogo({ url, name }: { url?: string | null; name: string }) {
  if (url) return <img src={url} alt="" className="team-logo" loading="lazy" />;
  return <div className="team-logo fallback">{name.slice(0, 1)}</div>;
}

function CardProgress({ rule, counts, hasDog }: { rule: WeekRule; counts: { total: number; cfb: number; nfl: number }; hasDog: boolean }) {
  const ok = counts.total === rule.regularTotal && counts.cfb === rule.cfbRequired && counts.nfl === rule.nflRequired && hasDog;
  return <div className={`card-progress ${ok ? "complete" : ""}`}><strong>{ok ? "Card complete" : "Card in progress"}</strong><span>{counts.cfb}/{rule.cfbRequired} CFB · {counts.nfl}/{rule.nflRequired} NFL · dog {hasDog ? "set" : "open"}</span></div>;
}

function PickList({ picks, games, title, lockPick, removePick }: { picks: Pick[]; games: Game[]; title: string; lockPick: (p: Pick) => void; removePick: (p: Pick) => void }) {
  return <div className="pick-section"><h3>{title}</h3>{!picks.length && <p className="muted">None yet.</p>}{picks.map((pick) => {
    const game = games.find((g) => g.id === pick.game_id) || pick.game;
    return <div className="pick-card" key={pick.id}>
      <div className="pick-top"><div><p className="pick-title">{pick.selected_team} {pick.pick_type === "underdog" && <span className="dog-tag">Dog +{pick.underdog_win_value || "?"}W</span>}</p><p className="pick-meta">{game?.away_team} at {game?.home_team}</p><p className="pick-meta">{pick.status === "locked" ? `Locked ${shortDt(pick.locked_at)} at ${spreadText(pick.locked_spread)}` : `Pick · current ${game ? spreadForTeam(game, pick.selected_team) : "line unknown"}`}</p></div><span className={`badge ${pick.status === "locked" ? "locked" : "open"}`}>{pick.status === "locked" ? "locked" : "pick"}</span></div>
      <div className="actions"><button className="btn gold" disabled={pick.status === "locked"} onClick={() => lockPick(pick)}><Lock size={13} /> Lock</button><button className="btn danger" disabled={pick.status === "locked"} onClick={() => removePick(pick)}>Remove</button></div>
    </div>;
  })}</div>;
}

function VisiblePick({ pick, games }: { pick: Pick; games: Game[] }) {
  const game = games.find((g) => g.id === pick.game_id) || pick.game;
  return <div className="visible-pick"><div><strong>{pick.selected_team} {pick.locked_spread != null ? spreadText(pick.locked_spread) : ""}</strong><p>{pick.pick_type === "underdog" ? `Underdog +${pick.underdog_win_value || "?"} wins · must win outright` : "Spread pick"} · locked {shortDt(pick.locked_at)}</p><p>{game?.away_team} at {game?.home_team}</p></div><span className="badge">{pick.result}</span></div>;
}
