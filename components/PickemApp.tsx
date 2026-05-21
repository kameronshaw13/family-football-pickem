"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, ChevronDown, EyeOff, Lock, LogOut, Shield, Trophy, Zap } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import type { Game, Pick, Profile, Standing, WeekRule, PickType } from "@/lib/types";
import { formatSpread, normalizeSpreadForSelectedTeam, spreadText, underdogWinValue } from "@/lib/spreads";
import { countRegularByLeague, getWeekRule } from "@/lib/weekRules";

type Tab = "board" | "card" | "group" | "standings" | "rules";
type Filter = "ALL" | "CFB" | "NFL" | "DOGS" | "OPEN" | "LOCKED";

type AppData = {
  currentUser: Profile;
  profiles: Profile[];
  games: Game[];
  picks: Pick[];
  standings: Standing[];
  week: number;
  weekRule: WeekRule;
  availableWeeks: number[];
};

function dt(iso: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }).format(new Date(iso));
}
function shortDt(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }).format(new Date(iso));
}
function spreadForTeam(game: Game, team: string) {
  return spreadText(normalizeSpreadForSelectedTeam(team, game.current_spread_team, game.current_spread));
}
function isClosed(game: Game) {
  return game.is_locked || new Date(game.lock_time) <= new Date();
}
function teamIsDog(game: Game, team: string) {
  return underdogWinValue(normalizeSpreadForSelectedTeam(team, game.current_spread_team, game.current_spread)) > 0;
}
function teamDogValue(game: Game, team: string) {
  return underdogWinValue(normalizeSpreadForSelectedTeam(team, game.current_spread_team, game.current_spread));
}

export default function PickemApp() {
  const [tab, setTab] = useState<Tab>("board");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [data, setData] = useState<AppData | null>(null);
  const [week, setWeek] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load(nextWeek = week) {
    setLoading(true);
    setMessage("");
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setMessage("Supabase environment variables are missing. Add them in Vercel and redeploy.");
      setLoading(false);
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
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

  async function postPick(body: any) {
    const supabase = getSupabaseBrowser();
    const { data: sessionData } = await supabase!.auth.getSession();
    const token = sessionData.session?.access_token;
    const response = await fetch("/api/picks", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) {
      alert(payload.error || "Pick action failed.");
      return false;
    }
    await load(week);
    return true;
  }

  async function signOut() {
    const supabase = getSupabaseBrowser();
    await supabase?.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) return <div className="app-shell"><main className="container"><div className="loading-card">Loading pick'em board…</div></main></div>;
  if (!data) return <div className="app-shell"><main className="container"><div className="error-card">{message || "Could not load app."}</div></main></div>;

  const { currentUser, games, picks, profiles, standings, availableWeeks } = data;
  const rule = data.weekRule || getWeekRule(data.week);
  const myPicks = picks.filter((p) => p.user_id === currentUser.id && p.week === data.week);
  const myRegular = myPicks.filter((p) => p.pick_type === "regular");
  const myUnderdog = myPicks.find((p) => p.pick_type === "underdog");
  const regularCounts = countRegularByLeague(myPicks, games);
  const lockedCount = myPicks.filter((p) => p.status === "locked").length;

  const filteredGames = games.filter((g) => {
    if (filter === "CFB") return g.league === "CFB";
    if (filter === "NFL") return g.league === "NFL";
    if (filter === "OPEN") return !isClosed(g);
    if (filter === "LOCKED") return isClosed(g);
    if (filter === "DOGS") return [g.away_team, g.home_team].some((team) => teamIsDog(g, team));
    return true;
  });

  function addDraftPick(game: Game, team: string, pickType: PickType) {
    postPick({ action: "draft", gameId: game.id, selectedTeam: team, pickType });
  }

  function lockPick(pick: Pick) {
    postPick({ action: "lock", pickId: pick.id });
  }

  function removePick(pick: Pick) {
    postPick({ action: "remove", pickId: pick.id });
  }

  return <div className="app-shell">
    <header className="scoreboard-header">
      <div className="scoreboard-topline">Family Football Pick'em</div>
      <div className="scoreboard-main">
        <div>
          <div className="score-title">{rule.label}</div>
          <div className="score-sub">{rule.regularTotal} regular · {rule.underdogTotal} dog · hidden until lock</div>
        </div>
        <button className="profile-button" onClick={signOut}><span>{currentUser.display_name}</span><LogOut size={14} /></button>
      </div>
      <div className="week-strip">
        {availableWeeks.length > 0 && <div className="week-select-wrap"><select value={data.week} onChange={(e) => load(Number(e.target.value))} className="week-select">
          {availableWeeks.map((w) => <option key={w} value={w}>{w === 0 ? "Week 0" : `Week ${w}`}</option>)}
        </select><ChevronDown size={14} /></div>}
        <div className="mini-record"><strong>{regularCounts.total}/{rule.regularTotal}</strong> regular · <strong>{myUnderdog ? 1 : 0}/{rule.underdogTotal}</strong> dog · <strong>{lockedCount}</strong> locked</div>
      </div>
    </header>

    <main className="container mobile-container">
      {message && <div className="error-card">{message}</div>}
      <section className="status-grid">
        <div className="status-card"><span>CFB</span><strong>{regularCounts.cfb}/{rule.cfbRequired}</strong></div>
        <div className="status-card"><span>NFL</span><strong>{regularCounts.nfl}/{rule.nflRequired}</strong></div>
        <div className="status-card gold"><span>Dog</span><strong>{myUnderdog ? `+${myUnderdog.underdog_win_value || "?"}` : "Open"}</strong></div>
      </section>

      <nav className="bottom-tabs">
        {(["board", "card", "group", "standings", "rules"] as Tab[]).map((t) => <button key={t} className={`bottom-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t === "card" ? "My Card" : t[0].toUpperCase() + t.slice(1)}</button>)}
      </nav>

      {tab === "board" && <section className="panel">
        <div className="panel-head">
          <div><h2>Pick Board</h2><p>Choose regular spread picks or one outright underdog.</p></div>
        </div>
        <div className="filter-row">
          {(["ALL", "CFB", "NFL", "DOGS", "OPEN", "LOCKED"] as Filter[]).map((f) => <button key={f} className={`chip ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>{f}</button>)}
        </div>
        <div className="game-list">
          {filteredGames.length === 0 && <div className="empty-state">No games loaded for this week yet. When the Odds API has games for this week, your cron job will fill this board.</div>}
          {filteredGames.map((game) => <GameCard key={game.id} game={game} picks={myPicks} rule={rule} addDraftPick={addDraftPick} />)}
        </div>
      </section>}

      {tab === "card" && <section className="panel">
        <div className="panel-head"><div><h2>My Card</h2><p>Draft picks can be changed. Locked picks freeze the spread.</p></div></div>
        <CardProgress rule={rule} counts={regularCounts} hasDog={Boolean(myUnderdog)} />
        <PickList picks={myRegular} games={games} title="Regular picks" lockPick={lockPick} removePick={removePick} />
        <PickList picks={myUnderdog ? [myUnderdog] : []} games={games} title="Underdog pick" lockPick={lockPick} removePick={removePick} />
      </section>}

      {tab === "group" && <section className="panel">
        <div className="panel-head"><div><h2><EyeOff size={18} /> Group Picks</h2><p>Other picks only appear after that game's lock time.</p></div></div>
        {profiles.map((profile) => <div key={profile.id} className="group-card">
          <h3>{profile.display_name}</h3>
          {picks.filter((p) => p.user_id === profile.id).length === 0 && <p className="muted">No visible picks yet.</p>}
          {picks.filter((p) => p.user_id === profile.id).map((pick) => <VisiblePick key={pick.id} pick={pick} games={games} />)}
        </div>)}
      </section>}

      {tab === "standings" && <section className="panel">
        <div className="panel-head"><div><h2><Trophy size={18} /> Standings</h2><p>Win percentage ignores pushes. Underdog wins add bonus wins.</p></div></div>
        <table className="standings-table"><thead><tr><th>Name</th><th>W</th><th>L</th><th>P</th><th>%</th></tr></thead><tbody>
          {standings.map((s) => <tr key={s.user_id}><td><strong>{s.display_name}</strong></td><td>{s.wins}</td><td>{s.losses}</td><td>{s.pushes}</td><td>{s.win_pct ? s.win_pct.toFixed(3).replace(/^0/, "") : "—"}</td></tr>)}
        </tbody></table>
      </section>}

      {tab === "rules" && <section className="panel rules-panel">
        <h2>Rules</h2>
        <div className="rule-row"><Shield size={18} /><span>Week 0: 3 college picks only.</span></div>
        <div className="rule-row"><Shield size={18} /><span>Week 1: 5 college picks only.</span></div>
        <div className="rule-row"><Shield size={18} /><span>After NFL starts: 3 college and 2 NFL regular picks.</span></div>
        <div className="rule-row"><Zap size={18} /><span>One underdog pick. +7 to +9.5 = 1 win, +10 to +19.5 = 2 wins, +20 or more = 3 wins.</span></div>
        <div className="rule-row"><Lock size={18} /><span>Underdog has to win outright. You cannot double dip with the same game/team.</span></div>
        <div className="rule-row"><CalendarClock size={18} /><span>Tuesday-Friday games close 24 hours before kickoff. Saturday, Sunday, and Monday games close Friday at 5 PM CT.</span></div>
      </section>}
    </main>
  </div>;
}

function GameCard({ game, picks, rule, addDraftPick }: { game: Game; picks: Pick[]; rule: WeekRule; addDraftPick: (game: Game, team: string, pickType: PickType) => void }) {
  const closed = isClosed(game);
  const existing = picks.find((p) => p.game_id === game.id);
  return <article className={`game-card ${closed ? "closed" : ""} ${existing ? "selected" : ""}`}>
    <div className="game-head">
      <div className="badges"><span className="badge">{game.league}</span><span className={`badge ${closed ? "locked" : "open"}`}>{closed ? "Closed" : "Open"}</span>{existing && <span className="badge picked">{existing.pick_type}</span>}</div>
      <div className="kick"><CalendarClock size={13} /> {dt(game.commence_time)}</div>
    </div>
    <div className="matchup">
      {[game.away_team, game.home_team].map((team) => {
        const dogValue = teamDogValue(game, team);
        const disabled = closed || Boolean(existing);
        return <div className="team-card" key={team}>
          <div className="team-left"><div className="team-name">{team}</div><div className="spread">{spreadForTeam(game, team)} {dogValue > 0 && <span className="dog-tag">Dog +{dogValue}W</span>}</div></div>
          <div className="team-actions">
            <button className="mini-btn" disabled={disabled} onClick={() => addDraftPick(game, team, "regular")}>Spread</button>
            <button className="mini-btn gold" disabled={disabled || dogValue === 0} onClick={() => addDraftPick(game, team, "underdog")}>Dog</button>
          </div>
        </div>;
      })}
    </div>
    <p className="small">Board line: {formatSpread(game.current_spread_team, game.current_spread)} · closes {dt(game.lock_time)}</p>
  </article>;
}

function CardProgress({ rule, counts, hasDog }: { rule: WeekRule; counts: { total: number; cfb: number; nfl: number }; hasDog: boolean }) {
  const ok = counts.total === rule.regularTotal && counts.cfb === rule.cfbRequired && counts.nfl === rule.nflRequired && hasDog;
  return <div className={`card-progress ${ok ? "complete" : ""}`}>
    <strong>{ok ? "Card complete" : "Card in progress"}</strong>
    <span>{counts.cfb}/{rule.cfbRequired} CFB · {counts.nfl}/{rule.nflRequired} NFL · dog {hasDog ? "set" : "open"}</span>
  </div>;
}

function PickList({ picks, games, title, lockPick, removePick }: { picks: Pick[]; games: Game[]; title: string; lockPick: (p: Pick) => void; removePick: (p: Pick) => void }) {
  return <div className="pick-section"><h3>{title}</h3>{!picks.length && <p className="muted">None yet.</p>}{picks.map((pick) => {
    const game = games.find((g) => g.id === pick.game_id) || pick.game;
    return <div className="pick-card" key={pick.id}>
      <div className="pick-top"><div><p className="pick-title">{pick.selected_team} {pick.pick_type === "underdog" && <span className="dog-tag">Dog +{pick.underdog_win_value || "?"}W</span>}</p><p className="pick-meta">{game?.away_team} at {game?.home_team}</p><p className="pick-meta">{pick.status === "locked" ? `Locked ${shortDt(pick.locked_at)} at ${spreadText(pick.locked_spread)}` : `Draft · current ${game ? spreadForTeam(game, pick.selected_team) : "line unknown"}`}</p></div><span className={`badge ${pick.status === "locked" ? "locked" : "open"}`}>{pick.status}</span></div>
      <div className="actions"><button className="btn gold" disabled={pick.status === "locked"} onClick={() => lockPick(pick)}><Lock size={13} /> Lock</button><button className="btn danger" disabled={pick.status === "locked"} onClick={() => removePick(pick)}>Remove</button></div>
    </div>;
  })}</div>;
}

function VisiblePick({ pick, games }: { pick: Pick; games: Game[] }) {
  const game = games.find((g) => g.id === pick.game_id) || pick.game;
  return <div className="visible-pick"><div><strong>{pick.selected_team} {pick.locked_spread != null ? spreadText(pick.locked_spread) : ""}</strong><p>{pick.pick_type === "underdog" ? `Underdog +${pick.underdog_win_value || "?"} wins · must win outright` : "Spread pick"} · locked {shortDt(pick.locked_at)}</p><p>{game?.away_team} at {game?.home_team}</p></div><span className="badge">{pick.result}</span></div>;
}
