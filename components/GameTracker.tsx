"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { LoaderCircle, X } from "lucide-react";
import type { Game } from "@/lib/types";
import { teamDisplayName } from "@/lib/teamNames";

type TrackerTab = "scoring" | "plays" | "box";
type Side = "away" | "home";

type TrackerPayload = {
  status: { state: string; detail: string; completed: boolean };
  teams: Record<Side, { id: string; name: string; abbreviation: string; logo: string; score: number | null }>;
  scoringPlays: Array<{ id: string; text: string; period: string; clock: string; teamSide: Side | null; homeScore: number | null; awayScore: number | null; type: string }>;
  plays: Array<{ id: string; text: string; period: string; clock: string; situation: string; teamSide: Side | null; scoringPlay: boolean; homeScore: number | null; awayScore: number | null; driveResult: string }>;
  teamStats: Array<{ label: string; away: string; home: string }>;
  playerStats: Array<{ side: Side; category: string; labels: string[]; athletes: Array<{ name: string; values: string[] }> }>;
};

function TeamLogo({ src, name }: { src?: string | null; name: string }) {
  return src ? <Image unoptimized src={src} alt="" width={46} height={46} /> : <span className="game-tracker-logo-fallback">{name.slice(0, 2).toUpperCase()}</span>;
}

async function loadTracker(gameId: string) {
  const token = window.localStorage.getItem("pickem_session_token") || "";
  const response = await fetch(`/api/game-tracker?gameId=${encodeURIComponent(gameId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store"
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Could not load GameTracker.");
  return payload as TrackerPayload;
}

function SideMark({ side, payload }: { side: Side | null; payload: TrackerPayload }) {
  if (!side) return <span className="game-tracker-play-mark neutral" />;
  const team = payload.teams[side];
  return <span className="game-tracker-play-mark"><TeamLogo src={team.logo} name={team.name} /></span>;
}

function Scoring({ payload }: { payload: TrackerPayload }) {
  if (!payload.scoringPlays.length) return <p className="game-tracker-empty">No scoring plays yet.</p>;
  return <div className="game-tracker-list">{payload.scoringPlays.map(play => <div className="game-tracker-play scoring" key={play.id}>
    <SideMark side={play.teamSide} payload={payload} />
    <div><strong>{play.text}</strong><small>{[play.period, play.clock].filter(Boolean).join(" · ")}</small></div>
    <span className="game-tracker-score">{play.awayScore ?? "—"}–{play.homeScore ?? "—"}</span>
  </div>)}</div>;
}

function Plays({ payload }: { payload: TrackerPayload }) {
  if (!payload.plays.length) return <p className="game-tracker-empty">Play-by-play is not available yet.</p>;
  return <div className="game-tracker-list">{payload.plays.map(play => <div className={`game-tracker-play ${play.scoringPlay ? "scoring" : ""}`.trim()} key={play.id}>
    <SideMark side={play.teamSide} payload={payload} />
    <div><strong>{play.text}</strong><small>{[play.period, play.clock, play.situation].filter(Boolean).join(" · ")}</small></div>
    {(play.homeScore != null || play.awayScore != null) && <span className="game-tracker-score">{play.awayScore ?? "—"}–{play.homeScore ?? "—"}</span>}
  </div>)}</div>;
}

function BoxScore({ payload }: { payload: TrackerPayload }) {
  const categories = ["passing", "rushing", "receiving"];
  return <div className="game-tracker-box">
    <section className="game-tracker-team-stats">
      <div className="game-tracker-box-head"><strong>{payload.teams.away.abbreviation || "Away"}</strong><span>TEAM</span><strong>{payload.teams.home.abbreviation || "Home"}</strong></div>
      {payload.teamStats.map(stat => <div className="game-tracker-stat-row" key={stat.label}><strong>{stat.away}</strong><span>{stat.label}</span><strong>{stat.home}</strong></div>)}
    </section>
    {categories.map(category => {
      const away = payload.playerStats.find(row => row.side === "away" && row.category === category);
      const home = payload.playerStats.find(row => row.side === "home" && row.category === category);
      if (!away && !home) return null;
      return <section className="game-tracker-player-section" key={category}>
        <h3>{category}</h3>
        <div className="game-tracker-player-columns">
          {(["away", "home"] as const).map(side => {
            const row = side === "away" ? away : home;
            return <div key={side}><strong className="game-tracker-player-team">{payload.teams[side].abbreviation || payload.teams[side].name}</strong>
              {row?.athletes.length ? row.athletes.map(athlete => <div className="game-tracker-player-row" key={athlete.name}><span>{athlete.name}</span><small>{athlete.values.join(" · ")}</small></div>) : <p className="game-tracker-player-empty">—</p>}
            </div>;
          })}
        </div>
      </section>;
    })}
  </div>;
}

export default function GameTracker({ game, onClose }: { game: Game; onClose: () => void }) {
  const [tab, setTab] = useState<TrackerTab>("scoring");
  const [payload, setPayload] = useState<TrackerPayload | null>(null);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const sheet = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    const priorOverflow = document.body.style.overflow;
    const priorFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const backdrop = sheet.current?.parentElement;
    const siblings = Array.from(document.body.children).filter((node): node is HTMLElement => node instanceof HTMLElement && node !== backdrop);
    const inertStates = siblings.map(node => node.inert);
    siblings.forEach(node => { node.inert = true; });
    sheet.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); close.current(); } };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = priorOverflow;
      siblings.forEach((node, index) => { node.inert = inertStates[index]; });
      priorFocus?.focus();
    };
  }, [mounted]);

  useEffect(() => {
    let active = true;
    let timer = 0;
    const refresh = async () => {
      try {
        const next = await loadTracker(game.id);
        if (!active) return;
        setPayload(next);
        setError("");
        if (!next.status.completed) timer = window.setTimeout(refresh, 5000);
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Could not load GameTracker.");
        timer = window.setTimeout(refresh, 10000);
      }
    };
    void refresh();
    return () => { active = false; window.clearTimeout(timer); };
  }, [game.id]);

  if (!mounted) return null;
  const awayName = teamDisplayName(game.league, game.away_team);
  const homeName = teamDisplayName(game.league, game.home_team);
  const tabs: Array<[TrackerTab, string]> = [["scoring", "Scoring"], ["plays", "Plays"], ["box", "Box Score"]];

  return createPortal(<div className="game-tracker-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={sheet} className="game-tracker-sheet" role="dialog" aria-modal="true" aria-label={`${awayName} at ${homeName} GameTracker`}>
      <header className="game-tracker-header"><span>GAMETRACKER</span><button type="button" onClick={onClose} aria-label="Close GameTracker"><X size={20} /></button></header>
      <div className="game-tracker-hero">
        <div className="game-tracker-team"><TeamLogo src={payload?.teams.away.logo || game.away_logo_url} name={awayName} /><strong>{awayName}</strong><b>{payload?.teams.away.score ?? game.live_away_score ?? game.final_away_score ?? "—"}</b></div>
        <div className="game-tracker-status"><strong>{payload?.status.detail || game.live_status || (game.live_completed ? "Final" : "Live")}</strong><span>at</span></div>
        <div className="game-tracker-team"><TeamLogo src={payload?.teams.home.logo || game.home_logo_url} name={homeName} /><strong>{homeName}</strong><b>{payload?.teams.home.score ?? game.live_home_score ?? game.final_home_score ?? "—"}</b></div>
      </div>
      <nav className="game-tracker-tabs" aria-label="GameTracker sections">{tabs.map(([id, label]) => <button type="button" key={id} className={tab === id ? "active" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => { setTab(id); sheet.current?.querySelector(".game-tracker-scroll")?.scrollTo(0, 0); }}>{label}</button>)}</nav>
      <div className="game-tracker-scroll">
        {!payload && !error && <div className="game-tracker-loading"><LoaderCircle size={22} /><span>Loading GameTracker…</span></div>}
        {error && !payload && <div className="game-tracker-empty" role="alert">{error}</div>}
        {payload && tab === "scoring" && <Scoring payload={payload} />}
        {payload && tab === "plays" && <Plays payload={payload} />}
        {payload && tab === "box" && <BoxScore payload={payload} />}
      </div>
    </section>
  </div>, document.body);
}
