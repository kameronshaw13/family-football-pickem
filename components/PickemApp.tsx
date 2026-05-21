"use client";

import { useMemo, useState } from "react";
import { CalendarClock, EyeOff, Lock, Trophy } from "lucide-react";
import type { Game, Pick, Profile, Standing } from "@/lib/types";
import { demoGames, demoPicks, demoProfiles } from "@/lib/demoData";
import { formatSpread, normalizeSpreadForSelectedTeam } from "@/lib/spreads";

type Tab = "board" | "picks" | "group" | "standings";
type Filter = "ALL" | "CFB" | "NFL" | "OPEN" | "LOCKED";

function dt(iso: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }).format(new Date(iso));
}

function shortDt(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }).format(new Date(iso));
}

function spreadForTeam(game: Game, team: string) {
  const spread = normalizeSpreadForSelectedTeam(team, game.current_spread_team, game.current_spread);
  if (spread == null) return "No line";
  return spread > 0 ? `+${spread}` : `${spread}`;
}

export default function PickemApp({ initialGames = demoGames, initialProfiles = demoProfiles, initialPicks = demoPicks, productionMode = false }: { initialGames?: Game[]; initialProfiles?: Profile[]; initialPicks?: Pick[]; productionMode?: boolean }) {
  const [tab, setTab] = useState<Tab>("board");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [userId, setUserId] = useState(initialProfiles[0]?.id || "kameron");
  const [games, setGames] = useState<Game[]>(initialGames);
  const [picks, setPicks] = useState<Pick[]>(initialPicks);

  const user = initialProfiles.find((p) => p.id === userId) || initialProfiles[0];
  const week = games[0]?.week || 1;
  const now = new Date();
  const revealCutoffPassed = true; // app API uses exact per-game reveal; demo shows group behavior.

  const myPicks = picks.filter((p) => p.user_id === userId && p.week === week);
  const myPickGameIds = new Set(myPicks.map((p) => p.game_id));

  const filteredGames = games.filter((g) => {
    if (filter === "CFB") return g.league === "CFB";
    if (filter === "NFL") return g.league === "NFL";
    if (filter === "OPEN") return !g.is_locked && new Date(g.lock_time) > now;
    if (filter === "LOCKED") return g.is_locked || new Date(g.lock_time) <= now;
    return true;
  });

  const standings = useMemo<Standing[]>(() => {
    return initialProfiles.map((profile) => {
      const userPicks = picks.filter((p) => p.user_id === profile.id && p.result !== "pending");
      const wins = userPicks.filter((p) => p.result === "win").length;
      const losses = userPicks.filter((p) => p.result === "loss").length;
      const pushes = userPicks.filter((p) => p.result === "push").length;
      const counted = wins + losses;
      return { user_id: profile.id, display_name: profile.display_name, wins, losses, pushes, win_pct: counted ? wins / counted : 0 };
    }).sort((a, b) => b.win_pct - a.win_pct || b.wins - a.wins);
  }, [picks, initialProfiles]);

  async function addDraftPick(game: Game, team: string) {
    if (new Date(game.lock_time) <= new Date()) return alert("That game is locked and cannot be picked.");
    if (productionMode) {
      const response = await fetch("/api/picks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "draft", userId, gameId: game.id, selectedTeam: team }) });
      const payload = await response.json();
      if (!response.ok) return alert(payload.error || "Could not save pick.");
      window.location.reload();
      return;
    }
    const existing = picks.find((p) => p.user_id === userId && p.game_id === game.id);
    if (!existing && myPicks.length >= 5) return alert("You already have 5 picks for this week.");
    if (existing?.status === "locked") return alert("That pick is already locked.");
    if (existing) {
      setPicks((curr) => curr.map((p) => p.id === existing.id ? { ...p, selected_team: team } : p));
      return;
    }
    setPicks((curr) => [...curr, {
      id: crypto.randomUUID(), user_id: userId, game_id: game.id, week, selected_team: team,
      status: "draft", locked_spread: null, locked_spread_team: null, locked_at: null, result: "pending", game
    }]);
  }

  async function lockPick(pick: Pick) {
    if (productionMode) {
      const response = await fetch("/api/picks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "lock", pickId: pick.id, userId }) });
      const payload = await response.json();
      if (!response.ok) return alert(payload.error || "Could not lock pick.");
      window.location.reload();
      return;
    }
    const game = games.find((g) => g.id === pick.game_id);
    if (!game) return;
    if (new Date(game.lock_time) <= new Date()) return alert("That game is already closed. The server auto-lock job would handle this in production.");
    setPicks((curr) => curr.map((p) => p.id === pick.id ? {
      ...p, status: "locked", locked_at: new Date().toISOString(), locked_spread: normalizeSpreadForSelectedTeam(p.selected_team, game.current_spread_team, game.current_spread), locked_spread_team: p.selected_team, game
    } : p));
  }

  function removePick(pick: Pick) {
    if (pick.status === "locked") return alert("Locked picks cannot be removed.");
    setPicks((curr) => curr.filter((p) => p.id !== pick.id));
  }

  return <div className="app-shell">
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <div className="logo-mark">FP</div>
          <div>
            <h1>Family Football Pick'em</h1>
            <p>Hidden picks · spread snapshots · W-L-P standings</p>
          </div>
        </div>
        <select className="user-pill" value={userId} onChange={(e) => setUserId(e.target.value)}>
          {initialProfiles.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
        </select>
      </div>
    </header>

    <main className="container">
      <div className="notice">
        {productionMode ? "Live database mode" : "Demo mode"}: Pick exactly 5 games. You can save draft picks, or lock early to freeze your spread. Tuesday-Friday games close 24 hours before kickoff. Saturday, Sunday, and Monday games close Friday at 5:00 PM CT. Group picks stay hidden until the game is closed.
      </div>

      <nav className="tabs">
        {(["board", "picks", "group", "standings"] as Tab[]).map((t) => <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t === "picks" ? "My Picks" : t[0].toUpperCase() + t.slice(1)}</button>)}
      </nav>

      {tab === "board" && <section className="grid">
        <div className="card">
          <div className="card-pad">
            <h2 className="card-title">Week {week} Board</h2>
            <p className="card-sub">Full CFB/NFL spread board. Closed games cannot be picked or changed.</p>
            <div className="filter-row">
              {(["ALL", "CFB", "NFL", "OPEN", "LOCKED"] as Filter[]).map((f) => <button key={f} className={`chip ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>{f}</button>)}
            </div>
          </div>
          <div className="game-list">
            {filteredGames.map((game) => {
              const closed = game.is_locked || new Date(game.lock_time) <= now;
              const hasPick = myPickGameIds.has(game.id);
              return <article key={game.id} className={`game-card ${closed ? "closed" : ""}`}>
                <div className="game-head">
                  <div className="badges"><span className="badge">{game.league}</span><span className={`badge ${closed ? "locked" : "open"}`}>{closed ? "Closed" : "Open"}</span>{hasPick && <span className="badge">Picked</span>}</div>
                  <div className="kick"><CalendarClock size={13} /> {dt(game.commence_time)}</div>
                </div>
                <div className="matchup">
                  {[game.away_team, game.home_team].map((team) => <div className="team-row" key={team}>
                    <div><div className="team-name">{team}</div><div className="spread">{spreadForTeam(game, team)}</div></div>
                    <button className="btn secondary" disabled={closed} onClick={() => addDraftPick(game, team)}>{closed ? "Locked" : "Pick"}</button>
                  </div>)}
                </div>
                <p className="small">Board line: {formatSpread(game.current_spread_team, game.current_spread)} · closes {dt(game.lock_time)}</p>
              </article>;
            })}
          </div>
        </div>

        <aside className="card card-pad">
          <h2 className="card-title">My Card</h2>
          <p className="card-sub">{myPicks.length}/5 picks selected. Locked picks freeze your spread.</p>
          <PickList picks={myPicks} games={games} lockPick={lockPick} removePick={removePick} />
        </aside>
      </section>}

      {tab === "picks" && <section className="card card-pad">
        <h2 className="card-title">My Picks</h2>
        <p className="card-sub">Drafts can still be changed. Locked picks cannot.</p>
        <PickList picks={myPicks} games={games} lockPick={lockPick} removePick={removePick} />
      </section>}

      {tab === "group" && <section className="card card-pad">
        <h2 className="card-title"><EyeOff size={18} /> Group Picks</h2>
        <p className="card-sub">In production, the API only returns other users' picks after each game's close/reveal time.</p>
        {initialProfiles.map((profile) => <div key={profile.id} className="pick-row">
          <h3 className="pick-title">{profile.display_name}</h3>
          {picks.filter((p) => p.user_id === profile.id).length === 0 && <p className="pick-meta">No visible picks yet.</p>}
          {picks.filter((p) => p.user_id === profile.id).map((pick) => <VisiblePick key={pick.id} pick={pick} games={games} />)}
        </div>)}
      </section>}

      {tab === "standings" && <section className="card card-pad">
        <h2 className="card-title"><Trophy size={18} /> Standings</h2>
        <p className="card-sub">Win percentage ignores pushes. Pushes do not count for or against you.</p>
        <table className="standings-table"><thead><tr><th>Name</th><th>W</th><th>L</th><th>P</th><th>Win %</th></tr></thead><tbody>
          {standings.map((s) => <tr key={s.user_id}><td><strong>{s.display_name}</strong></td><td>{s.wins}</td><td>{s.losses}</td><td>{s.pushes}</td><td>{s.win_pct ? s.win_pct.toFixed(3).replace(/^0/, "") : "—"}</td></tr>)}
        </tbody></table>
      </section>}
    </main>
  </div>;
}

function PickList({ picks, games, lockPick, removePick }: { picks: Pick[]; games: Game[]; lockPick: (p: Pick) => void; removePick: (p: Pick) => void }) {
  if (!picks.length) return <p className="small">No picks yet. Go to the board and select a side.</p>;
  return <>{picks.map((pick) => {
    const game = games.find((g) => g.id === pick.game_id) || pick.game;
    return <div className="pick-row" key={pick.id}>
      <div className="pick-top">
        <div>
          <p className="pick-title">{pick.selected_team}</p>
          <p className="pick-meta">{game?.away_team} at {game?.home_team}</p>
          <p className="pick-meta">{pick.status === "locked" ? `Locked ${shortDt(pick.locked_at)} at ${pick.locked_spread && pick.locked_spread > 0 ? "+" : ""}${pick.locked_spread}` : `Draft · current ${game ? spreadForTeam(game, pick.selected_team) : "line unknown"}`}</p>
        </div>
        <span className={`badge ${pick.status === "locked" ? "locked" : "open"}`}>{pick.status}</span>
      </div>
      <div className="actions">
        <button className="btn gold" disabled={pick.status === "locked"} onClick={() => lockPick(pick)}><Lock size={13} /> Lock Pick</button>
        <button className="btn danger" disabled={pick.status === "locked"} onClick={() => removePick(pick)}>Remove</button>
      </div>
    </div>;
  })}</>;
}

function VisiblePick({ pick, games }: { pick: Pick; games: Game[] }) {
  const game = games.find((g) => g.id === pick.game_id) || pick.game;
  return <div className="team-row">
    <div>
      <div className="team-name">{pick.selected_team} {pick.locked_spread != null ? `${pick.locked_spread > 0 ? "+" : ""}${pick.locked_spread}` : ""}</div>
      <div className="spread">{game?.away_team} at {game?.home_team} · locked {shortDt(pick.locked_at)}</div>
    </div>
    <span className="badge">{pick.result}</span>
  </div>;
}
