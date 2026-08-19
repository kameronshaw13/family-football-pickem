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

export default function PlayerProfiles() {
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [loadingName, setLoadingName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function open(name: string) {
      const token = window.localStorage.getItem("pickem_session_token");
      if (!token || !name) return;
      setLoadingName(name);
      setError("");
      try {
        const response = await fetch(`/api/player-profile?name=${encodeURIComponent(name)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store"
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load player profile.");
        if (active) setProfile(payload as ProfilePayload);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load player profile.");
      } finally {
        if (active) setLoadingName("");
      }
    }

    function activate(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLElement>(".player-profile-link[data-player-profile-name]");
      const name = button?.dataset.playerProfileName || "";
      if (name) void open(name);
    }

    document.addEventListener("click", activate);
    return () => {
      active = false;
      document.removeEventListener("click", activate);
    };
  }, []);

  useEffect(() => {
    if (!profile) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfile(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const html = document.documentElement;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      htmlOverflow: html.style.overflow
    };

    html.classList.add("player-profile-open");
    body.classList.add("player-profile-open");
    html.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      html.classList.remove("player-profile-open");
      body.classList.remove("player-profile-open");
      html.style.overflow = previous.htmlOverflow;
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [profile]);

  return <>
    {loadingName && <div className="profile-loading-toast" role="status">Loading {loadingName}…</div>}
    {error && <div className="profile-loading-toast profile-error-toast" role="alert">{error}</div>}
    {profile && <div className="player-profile-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfile(null); }}>
      <section className="player-profile-sheet" role="dialog" aria-modal="true" aria-labelledby="player-profile-title">
        <header className="player-profile-head">
          <div><span>Player Profile</span><h2 id="player-profile-title">{profile.player.displayName}</h2></div>
          <div className="pick-row-actions player-profile-close-wrap"><button type="button" className="icon-btn" aria-label="Close profile" onClick={() => setProfile(null)}><X size={16} /></button></div>
        </header>

        <div className="player-profile-record">
          <div><span>Season</span><strong>{record(profile.season.wins, profile.season.losses, profile.season.pushes)}</strong></div>
          <div><span>Win %</span><strong>{(profile.season.winPct * 100).toFixed(1)}%</strong></div>
          <div><span>Weekly Wins</span><strong>{profile.season.weeklyWins}</strong></div>
        </div>

        <section className="player-profile-section">
          <h3>Career Marks</h3>
          <div className="player-profile-stat-grid">
            <div><span>Shaw Pick'em Titles</span><strong>{profile.legacy.titlesTracked ? profile.legacy.titles : "—"}</strong></div>
            <div><span>Longest Dog Won</span><strong>{profile.signature.longestDog ? spread(profile.signature.longestDog.spread) : "—"}</strong><small>{profile.signature.longestDog?.team || "No dog win yet"}</small></div>
            <div><span>Most Picked Team</span><strong>{profile.signature.mostPickedTeam || "—"}</strong></div>
            <div><span>Best Pick Streak</span><strong>{profile.signature.bestPickStreak || "—"}</strong></div>
          </div>
          {!profile.legacy.titlesTracked && <p className="player-profile-footnote">Historical titles can be added later.</p>}
        </section>

        <section className="player-profile-section">
          <h3>Dogs &amp; Side Bets</h3>
          <div className="player-profile-stat-grid compact">
            <div><span>Dog Record</span><strong>{record(profile.signature.dogRecord.wins, profile.signature.dogRecord.losses, profile.signature.dogRecord.pushes)}</strong></div>
            <div><span>Side Bet Record</span><strong>{record(profile.sideBets.wins, profile.sideBets.losses, profile.sideBets.pushes)}</strong></div>
            <div><span>Side Bet Net</span><strong className={profile.sideBets.net > 0 ? "money-pos" : profile.sideBets.net < 0 ? "money-neg" : ""}>{profile.sideBets.netText}</strong></div>
          </div>
        </section>

        <section className="player-profile-section player-profile-rivals">
          <h3>Head-to-Head</h3>
          <div className="player-rival-labels"><span>Opponent</span><span>Opp. Picks</span><span>Side Bets</span><span>$</span></div>
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
