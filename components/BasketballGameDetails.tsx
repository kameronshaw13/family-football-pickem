"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { LoaderCircle, X } from "lucide-react";
import type { Game } from "@/lib/types";
import { getClientSessionToken } from "@/lib/clientSession";
import useGameSheetDismiss from "@/hooks/useGameSheetDismiss";
import CollegeBasketballAnalytics from "@/components/CollegeBasketballAnalytics";

type Play = { id: string; text: string; period: number; clock: string; scoring: boolean; awayScore: number | null; homeScore: number | null };
type Team = { score?: string; records?: { summary: string; type?: string }[]; team?: { displayName?: string; logo?: string } };
type Payload = {
  status: { state?: string; shortDetail?: string; detail?: string; completed?: boolean };
  teams: { away?: Team; home?: Team };
  stats: { label: string; away: string; home: string }[];
  players: { id: string; name: string; groups: { labels: string[]; athletes: { id: string; name: string; stats: string[] }[] }[] }[];
  leaders: { name: string; categories: { label: string; athletes: { name: string; value: string }[] }[] }[];
  plays: Play[];
};
type Tab = "preview" | "live" | "scoring" | "plays" | "box";
type DetailMode = "preview" | "tracker";
function periodLabel(period: number, college: boolean) {
  const regulation = college ? 2 : 4;
  return period > regulation ? `${period - regulation}OT` : college ? `${period === 1 ? "1st" : "2nd"} Half` : `Q${period}`;
}

export default function BasketballGameDetails({ game, onClose, mode }: { game: Game; onClose: () => void; mode: DetailMode }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>(mode === "preview" ? "preview" : "live");
  const sheet = useRef<HTMLElement | null>(null);
  const scrollArea = useRef<HTMLDivElement | null>(null);
  const close = useGameSheetDismiss(sheet, mounted, onClose);

  useEffect(() => {
    setMounted(true);
    const priorFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const controls = sheet.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]');
        if (!controls?.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keyboard); priorFocus?.focus(); };
  }, [onClose]);
  useEffect(() => { if (mounted) sheet.current?.querySelector<HTMLButtonElement>("button")?.focus(); }, [mounted]);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function load() {
      let complete = false;
      try {
        const token = getClientSessionToken();
        const response = await fetch(`/api/basketball-game?gameId=${encodeURIComponent(game.id)}`, {
          headers: { Authorization: `Bearer ${token}`, "x-pickem-group": "friends-basketball" }, cache: "no-store", signal: controller.signal
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load this game.");
        complete = Boolean(data.status?.completed);
        if (!cancelled) { setPayload(data); setError(""); }
      } catch (failure) { if (!cancelled) setError(failure instanceof Error ? failure.message : "Could not load game."); }
      if (!cancelled && !complete) timer = setTimeout(load, 5000);
    }
    void load();
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [game.id]);
  useEffect(() => {
    setTab(mode === "preview" ? "preview" : game.live_completed ? "scoring" : "live");
  }, [game.id, mode]);

  useEffect(() => {
    if (mode === "tracker" && payload?.status.completed && tab === "live") setTab("scoring");
  }, [mode, payload?.status.completed, tab]);

  if (!mounted) return null;
  const pregame = (payload?.status.state || game.live_state || "pre") === "pre";
  const tabs: [Tab, string][] = [["live", "Live"], ["scoring", "Scoring"], ["plays", "Plays"], ["box", "Box Score"]].filter(([id]) => !payload?.status.completed || id !== "live") as [Tab, string][];
  const plays = (payload?.plays || []).filter((play) => tab !== "scoring" || play.scoring);
  const sortedPlays = payload?.status.completed ? plays : [...plays].reverse();
  const periodGroups = sortedPlays.reduce<{ period: number; plays: Play[] }[]>((groups, play) => {
    const latest = groups[groups.length - 1];
    if (!latest || latest.period !== play.period) groups.push({ period: play.period, plays: [play] });
    else latest.plays.push(play);
    return groups;
  }, []);
  const status = payload?.status.shortDetail || payload?.status.detail || game.live_status || new Date(game.commence_time).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

  return createPortal(<div className="game-tracker-backdrop" onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section ref={sheet} className={`game-tracker-sheet basketball-details ${mode === "preview" ? "basketball-matchup-preview" : "basketball-game-tracker"}`} role="dialog" aria-modal="true" aria-label={`${game.away_team} at ${game.home_team} ${mode === "preview" ? "matchup preview" : "GameTracker"}`}>
      <header className="game-tracker-header"><div className="game-detail-title"><strong>{game.away_team} at {game.home_team}</strong></div><button type="button" onClick={close} aria-label="Close game details"><X size={18} /></button></header>
      <div className="basketball-scoreboard">
        {(["away", "home"] as const).map((side) => <div className="basketball-score-team" key={side}>
          <span className="basketball-score-team-name">{game[`${side}_team`]}</span>
          {game[`${side}_logo_url`] && <Image unoptimized src={game[`${side}_logo_url`]!} alt={game[`${side}_team`]} width={58} height={58} />}
          <strong>{pregame ? "—" : payload?.teams[side]?.score ?? game[`final_${side}_score`] ?? game[`live_${side}_score`] ?? "—"}</strong>
          <small>{payload?.teams[side]?.records?.find((record) => record.type === "total")?.summary || ""}</small>
        </div>)}
        <span className="basketball-game-status">{status}</span>
      </div>
      {mode === "tracker" && <nav className={`game-tracker-tabs ${payload?.status.completed ? "completed" : ""}`} aria-label="Basketball GameTracker sections">{tabs.map(([id, label]) => <button type="button" key={id} className={tab === id ? "active" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => { setTab(id); scrollArea.current?.scrollTo(0, 0); }}>{label}</button>)}</nav>}
      <div ref={scrollArea} className="game-tracker-scroll">
        {game.league === "CBB" && tab === "preview" && <CollegeBasketballAnalytics gameId={game.id} />}
        {!payload && !error && <div className="game-tracker-loading"><LoaderCircle size={22} /><span>Loading game…</span></div>}
        {error && <p className="game-tracker-empty" role="alert">{error}</p>}
        {payload && (tab === "preview" || tab === "live") && <>
          <div className="basketball-matchup-line">{game.current_spread_team && game.current_spread != null ? `${game.current_spread_team} ${game.current_spread > 0 ? "+" : ""}${game.current_spread}` : "Spread not available yet"}</div>
          {payload.stats.length > 0 && <table className="basketball-stats"><thead><tr><th scope="col">{game.away_team}</th><th scope="col">Team Stats</th><th scope="col">{game.home_team}</th></tr></thead><tbody>{payload.stats.map((row) => <tr key={row.label}><td>{row.away}</td><th scope="row">{row.label}</th><td>{row.home}</td></tr>)}</tbody></table>}
          {payload.leaders.map((team) => <section className="basketball-leaders" key={team.name}><h3>{team.name}</h3>{team.categories.map((category) => <p key={category.label}><strong>{category.label}</strong>{category.athletes.map((athlete) => <span key={athlete.name}>{athlete.name} · {athlete.value}</span>)}</p>)}</section>)}
          {!payload.stats.length && !payload.leaders.length && <p className="game-tracker-empty">Team statistics will appear when available.</p>}
        </>}
        {payload && (tab === "plays" || tab === "scoring") && <div className="basketball-play-list">{!periodGroups.length && <p className="game-tracker-empty">{pregame ? "Play-by-play begins at tipoff." : "No plays available yet."}</p>}{periodGroups.map((group, index) => <section className="basketball-play-period" key={`${group.period}-${index}`} aria-label={`${periodLabel(group.period, game.league === "CBB")} plays`}>
          <div className="game-tracker-quarter-header">{periodLabel(group.period, game.league === "CBB")}</div>
          {group.plays.map((play) => <div className="basketball-play" key={play.id}><small>{play.clock}</small><p>{play.clock && play.text.startsWith(play.clock + " ") ? play.text.slice(play.clock.length + 1) : play.text}</p>{play.scoring && <strong>{play.awayScore ?? "—"}–{play.homeScore ?? "—"}</strong>}</div>)}
        </section>)}</div>}
        {payload && tab === "box" && <>{!payload.players.length && <p className="game-tracker-empty">Box scores appear when available.</p>}{payload.players.map((team) => <section key={team.id} className="basketball-box"><h3>{team.name}</h3>{team.groups.map((group, index) => <div className="basketball-table-scroll" key={index} tabIndex={0} role="region" aria-label={`${team.name} player statistics`}><table><thead><tr><th scope="col">Player</th>{group.labels.map((label, index) => <th scope="col" key={`${label}-${index}`}>{label}</th>)}</tr></thead><tbody>{group.athletes.map((athlete) => <tr key={athlete.id}><th scope="row">{athlete.name}</th>{athlete.stats.map((stat, index) => <td key={index}>{stat}</td>)}</tr>)}</tbody></table></div>)}</section>)}</>}
      </div>
    </section>
  </div>, document.body);
}
