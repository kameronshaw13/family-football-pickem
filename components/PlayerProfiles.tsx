"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type ProfilePayload = {
  player: { id: string; displayName: string };
  season: { wins: number; losses: number; pushes: number; winPct: number; weeklyWins: number };
  legacy: { titles: number | null; titlesTracked: boolean };
  signature: {
    longestDog: { team: string; spread: number } | null;
    mostPickedTeam: string | null;
    bestPickStreak: number;
    dogRecord: { wins: number; losses: number; pushes: number };
  };
  sideBets: { wins: number; losses: number; pushes: number; net: number; netText: string };
  headToHead: Array<{
    opponent: string;
    pickem: { wins: number; losses: number; ties: number };
    sideBets: { wins: number; losses: number; pushes: number; net: number; netText: string };
  }>;
};

function record(wins: number, losses: number, pushes: number) {
  return `${wins}-${losses}-${pushes}`;
}

function spread(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
}

function makeSeasonNamesInteractive() {
  const heading = Array.from(document.querySelectorAll<HTMLElement>(".standings-panel .scoreboard-heading h2"))
    .find((node) => node.textContent?.trim() === "Season Standings");
  const leaderboard = heading?.closest(".scoreboard-heading")?.nextElementSibling;
  if (!(leaderboard instanceof HTMLElement) || !leaderboard.classList.contains("leaderboard")) return;
  leaderboard.querySelectorAll<HTMLElement>(".leaderboard-player strong").forEach((name) => {
    name.classList.add("player-profile-link");
    name.setAttribute("role", "button");
    name.setAttribute("tabindex", "0");
    name.setAttribute("aria-label", `Open ${name.textContent?.trim() || "player"} profile`);
  });
}

export default function PlayerProfiles() {
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [loadingName, setLoadingName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(makeSeasonNamesInteractive);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true });
    schedule();

    async function open(name: string) {
      const token = window.localStorage.getItem("pickem_session_token");
      if (!token) return;
      setLoadingName(name);
      setError("");
      try {
        const response = await fetch(`/api/player-profile?name=${encodeURIComponent(name)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store"
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load player profile.");
        setProfile(payload as ProfilePayload);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not load player profile.");
      } finally {
        setLoadingName("");
      }
    }

    function activate(event: Event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const name = target.closest<HTMLElement>(".player-profile-link");
      if (!name) return;
      if (event instanceof KeyboardEvent && !["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      void open(name.textContent?.trim() || "");
    }

    document.addEventListener("click", activate);
    document.addEventListener("keydown", activate);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("click", activate);
      document.removeEventListener("keydown", activate);
    };
  }, []);

  useEffect(() => {
    if (!profile) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setProfile(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [profile]);

  return <>
    {loadingName && <div className="profile-loading-toast" role="status">Loading {loadingName}…</div>}
    {error && <div className="profile-loading-toast profile-error-toast" role="alert">{error}</div>}
    {profile && <div className="player-profile-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfile(null); }}>
      <section className="player-profile-sheet" role="dialog" aria-modal="true" aria-labelledby="player-profile-title">
        <header className="player-profile-head">
          <div><span>Player Profile</span><h2 id="player-profile-title">{profile.player.displayName}</h2></div>
          <button type="button" aria-label="Close profile" onClick={() => setProfile(null)}><X size={19} /></button>
        </header>

        <div className="player-profile-record">
          <div><span>Season</span><strong>{record(profile.season.wins, profile.season.losses, profile.season.pushes)}</strong></div>
          <div><span>Win %</span><strong>{(profile.season.winPct * 100).toFixed(1)}%</strong></div>
          <div><span>Weekly Wins</span><strong>{profile.season.weeklyWins}</strong></div>
        </div>

        <section className="player-profile-section">
          <h3>Career Marks</h3>
          <div className="player-profile-stat-grid">
            <div><span>Shaw Pick'em Titles</span><strong>{profile.legacy.titlesTracked ? profile.legacy.titles : "—"}</strong><small>{profile.legacy.titlesTracked ? "" : "Historical titles can be added later"}</small></div>
            <div><span>Longest Dog Won</span><strong>{profile.signature.longestDog ? spread(profile.signature.longestDog.spread) : "—"}</strong><small>{profile.signature.longestDog?.team || "No dog win yet"}</small></div>
            <div><span>Most Picked Team</span><strong>{profile.signature.mostPickedTeam || "—"}</strong></div>
            <div><span>Best Pick Streak</span><strong>{profile.signature.bestPickStreak || "—"}</strong></div>
          </div>
        </section>

        <section className="player-profile-section">
          <h3>Dogs & Side Bets</h3>
          <div className="player-profile-stat-grid compact">
            <div><span>Dog Record</span><strong>{record(profile.signature.dogRecord.wins, profile.signature.dogRecord.losses, profile.signature.dogRecord.pushes)}</strong></div>
            <div><span>Side Bet Record</span><strong>{record(profile.sideBets.wins, profile.sideBets.losses, profile.sideBets.pushes)}</strong></div>
            <div><span>Side Bet Net</span><strong className={profile.sideBets.net > 0 ? "money-pos" : profile.sideBets.net < 0 ? "money-neg" : ""}>{profile.sideBets.netText}</strong></div>
          </div>
        </section>

        <section className="player-profile-section player-profile-rivals">
          <h3>Vs The League</h3>
          <div className="player-rival-labels"><span>Opponent</span><span>Pick'em</span><span>Side Bets</span><span>$</span></div>
          {profile.headToHead.map((row) => <div className="player-rival-row" key={row.opponent}>
            <strong>{row.opponent}</strong>
            <span>{row.pickem.wins}-{row.pickem.losses}-{row.pickem.ties}</span>
            <span>{row.sideBets.wins}-{row.sideBets.losses}-{row.sideBets.pushes}</span>
            <strong className={row.sideBets.net > 0 ? "money-pos" : row.sideBets.net < 0 ? "money-neg" : ""}>{row.sideBets.netText}</strong>
          </div>)}
        </section>
      </section>
    </div>}
  </>;
}
