"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { LoaderCircle } from "lucide-react";
import GameDetailClose from "@/components/GameDetailClose";
import BasketballShotChart from "@/components/BasketballShotChart";
import type { Game } from "@/lib/types";
import { getClientSessionToken } from "@/lib/clientSession";
import useGameSheetDismiss from "@/hooks/useGameSheetDismiss";
import { teamDisplayName, teamAbbreviatedName } from "@/lib/teamNames";
import { playTextWithoutDuplicateClock } from "@/lib/playText";
import { basketballPeriodLabel, type BasketballShot } from "@/lib/basketballShots";
import { scoreFromCompetitor } from "@/lib/espnSchedule";
import { trackerDisplayScore } from "@/lib/trackerDisplayScore";

type Play = { id: string; text: string; period: number; clock: string; scoring: boolean; awayScore: number | null; homeScore: number | null };
type Team = { score?: string; records?: { summary: string; type?: string }[]; team?: { id?: string; displayName?: string; logo?: string; color?: string } };
type Payload = {
  status: { state?: string; shortDetail?: string; detail?: string; completed?: boolean; period?: number; clock?: string };
  teams: { away?: Team; home?: Team };
  stats: { label: string; away: string; home: string }[];
  players: { id: string; side: "away" | "home"; name: string; groups: { labels: string[]; athletes: { id: string; name: string; stats: string[] }[] }[] }[];
  plays: Play[]; shots: BasketballShot[]; shotAttempts: number;
};
type Tab = "live" | "scoring" | "plays" | "box";
type Side = "away" | "home";

export default function BasketballGameDetails({ game, onClose }: { game: Game; onClose: () => void }) {
  const [payload, setPayload] = useState<Payload | null>(null), [error, setError] = useState("");
  const signature = useRef("");
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>(game.live_completed ? "scoring" : "live");
  const [boxTeam, setBoxTeam] = useState<"all" | Side>("all");
  const [retry, setRetry] = useState(0);
  const sheet = useRef<HTMLElement | null>(null), scrollArea = useRef<HTMLDivElement | null>(null);
  const close = useGameSheetDismiss(sheet, mounted, onClose);
  useEffect(() => {
    setMounted(true);
    const priorFocus = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let switchedDestination = false;
    const navigate = (event: MouseEvent) => { if (event.target instanceof Element && event.target.closest(".primary-nav button")) { switchedDestination = true; onClose(); } };
    const keyboard = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } };
    document.addEventListener("click", navigate, true); document.addEventListener("keydown", keyboard);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("click", navigate, true); document.removeEventListener("keydown", keyboard); if (!switchedDestination) priorFocus?.focus(); };
  }, [onClose]);
  useEffect(() => { if (mounted) sheet.current?.querySelector<HTMLButtonElement>("button")?.focus(); }, [mounted]);
  useEffect(() => {
    setPayload(null); signature.current = ""; setError("");
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function load() {
      let complete = false;
      try {
        const response = await fetch(`/api/basketball-game?gameId=${encodeURIComponent(game.id)}`, {
          headers: { Authorization: `Bearer ${getClientSessionToken()}`, "x-pickem-group": "friends-basketball" }, cache: "no-store", signal: controller.signal
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load this game.");
        complete = Boolean(data.status?.completed);
        if (!cancelled) {
          const next = JSON.stringify(data);
          if (signature.current !== next) { signature.current = next; setPayload(data); }
          setError("");
        }
      } catch (failure) { if (!cancelled) setError(failure instanceof Error ? failure.message : "Could not load game."); }
      if (!cancelled && !complete) timer = setTimeout(load, 5000);
    }
    void load();
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [game.id, retry]);
  useEffect(() => { setTab(game.live_completed ? "scoring" : "live"); setBoxTeam("all"); }, [game.id, game.live_completed]);

  if (!mounted) return null;
  const completed = Boolean(payload?.status.completed || game.live_completed || (game.final_away_score != null && game.final_home_score != null));
  const pregame = !completed && (payload?.status.state || game.live_state || "pre") === "pre";
  const names = { away: teamDisplayName(game.league, game.away_team), home: teamDisplayName(game.league, game.home_team) };
  const logos = { away: game.away_logo_url, home: game.home_logo_url };
  const scores = Object.fromEntries((["away", "home"] as const).map(side => [side, pregame ? null : trackerDisplayScore(completed, game.live_state === "in", game[`final_${side}_score`], game[`live_${side}_score`], scoreFromCompetitor(payload?.teams[side]), null)])) as Record<Side, number | null>;
  const plays = (payload?.plays || []).filter(play => tab !== "scoring" || play.scoring);
  const sortedPlays = completed ? plays : [...plays].reverse();
  const periodGroups = sortedPlays.reduce<{ period: number; plays: Play[] }[]>((groups, play) => {
    const latest = groups[groups.length - 1];
    if (!latest || latest.period !== play.period) groups.push({ period: play.period, plays: [play] });
    else latest.plays.push(play);
    return groups;
  }, []);
  const tabs: [Tab, string][] = [["live", completed ? "Shot Chart" : "Live"], ["scoring", "Scoring"], ["plays", "Plays"], ["box", "Box Score"]];
  const color = (side: Side) => /^([0-9a-f]{6}|[0-9a-f]{3})$/i.test(payload?.teams[side]?.team?.color || "") ? `#${payload!.teams[side]!.team!.color}` : "transparent";
  const teamStats = payload && <table className="basketball-stats"><thead><tr><th scope="col">{names.away}</th><th scope="col">Team Stats</th><th scope="col">{names.home}</th></tr></thead><tbody>{payload.stats.map(row => <tr key={row.label}><td>{row.away}</td><th scope="row">{row.label}</th><td>{row.home}</td></tr>)}</tbody></table>;

  return createPortal(<div className="game-tracker-backdrop" onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <section ref={sheet} className="game-tracker-sheet basketball-details basketball-game-tracker" role="dialog" aria-modal="false" aria-label={`${names.away} at ${names.home} GameTracker`}>
      <header className="game-tracker-header"><div className="game-detail-title"><strong>{names.away} at {names.home}</strong></div><GameDetailClose onClose={close} label="Close GameTracker" /></header>
      <div className="game-tracker-scoreboard"><div className="game-tracker-scoreboard-grid" style={{ "--tracker-away-color": color("away"), "--tracker-home-color": color("home") } as CSSProperties}>
        {(["away", "home"] as const).map(side => <div className={`game-tracker-score-team ${side}`} key={side}>
          <div className="game-tracker-score-team-main">{logos[side] ? <Image unoptimized src={logos[side]!} alt={names[side]} width={50} height={50} /> : <span className="game-tracker-logo-fallback">{names[side].slice(0, 1)}</span>}<div className="game-tracker-score-stack"><b className={completed && scores.away != null && scores.home != null ? scores[side]! > scores[side === "away" ? "home" : "away"]! ? "winner" : "loser" : ""}>{scores[side] ?? "—"}</b></div></div>
          <span className="game-tracker-score-team-name">{game.league === "CBB" && game[`${side}_rank`] != null && <small>#{game[`${side}_rank`]} </small>}{names[side]}</span>
          {payload?.teams[side]?.records?.find(record => record.type === "total")?.summary && <small className="basketball-tracker-record">{payload.teams[side]!.records!.find(record => record.type === "total")!.summary}</small>}
        </div>)}
        <div className={`game-tracker-score-center ${completed ? "final" : ""}`}>
          {completed ? <strong>FINAL</strong> : pregame ? <><span>TIPOFF</span><strong className="basketball-tipoff-time">{new Date(game.commence_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}</strong><small>CT</small></> : <><span className="game-tracker-center-period">{basketballPeriodLabel(payload?.status.period || 1, game.league === "CBB")}</span><strong className="game-tracker-center-clock">{payload?.status.clock || game.live_status?.match(/\d{1,2}:\d{2}/)?.[0] || "—"}</strong></>}
        </div>
      </div></div>
      <nav className="game-tracker-tabs" aria-label="Basketball GameTracker sections">{tabs.map(([id, label]) => <button type="button" key={id} className={tab === id ? "active" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => { setTab(id); scrollArea.current?.scrollTo(0, 0); }}>{label}</button>)}</nav>
      <div ref={scrollArea} className="game-tracker-scroll">
        {!payload && !error && <div className="game-tracker-loading" role="status"><LoaderCircle size={22} /><span>Loading game…</span></div>}
        {error && <div className="game-tracker-empty" role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
        {payload && tab === "live" && <><BasketballShotChart key={game.id} shots={payload.shots || []} attempts={payload.shotAttempts || 0} college={game.league === "CBB"} period={payload.status.period || 1}
          away={{ id: String(payload.teams.away?.team?.id || "away"), name: names.away }} home={{ id: String(payload.teams.home?.team?.id || "home"), name: names.home }} />{payload.stats.length > 0 && teamStats}</>}
        {payload && (tab === "plays" || tab === "scoring") && <div className="basketball-play-list">{!periodGroups.length && <p className="game-tracker-empty">{pregame ? "Play-by-play begins at tipoff." : "No plays available yet."}</p>}{periodGroups.map((group, index) => <section className="basketball-play-period" key={`${group.period}-${index}`} aria-label={`${basketballPeriodLabel(group.period, game.league === "CBB")} ${tab}`}>
          <div className="game-tracker-quarter-header"><span>{basketballPeriodLabel(group.period, game.league === "CBB")}</span>{tab === "scoring" && <div className="basketball-period-scores">{(["away", "home"] as const).map(side => logos[side] ? <Image unoptimized key={side} src={logos[side]!} alt={names[side]} width={22} height={22} /> : <span key={side}>{names[side]}</span>)}</div>}</div>
          {group.plays.map(play => <div className="basketball-play" key={play.id}><time>{play.clock}</time><p>{playTextWithoutDuplicateClock(play.text, play.clock)}</p>{play.scoring && <div className="basketball-period-scores" aria-label={`${names.away} ${play.awayScore ?? "—"}, ${names.home} ${play.homeScore ?? "—"}`}><strong>{play.awayScore ?? "—"}</strong><strong>{play.homeScore ?? "—"}</strong></div>}</div>)}
        </section>)}</div>}
        {payload && tab === "box" && <div className="game-tracker-box">
          <div className="game-tracker-box-selector" role="group" aria-label="Box score team">{(["away", "all", "home"] as const).map(side => <button type="button" key={side} className={boxTeam === side ? "active" : ""} aria-pressed={boxTeam === side} onClick={() => setBoxTeam(side)}>{side === "all" ? "All" : <>{logos[side] && <Image unoptimized src={logos[side]!} alt="" width={20} height={20} />}<span>{teamAbbreviatedName(game.league, game[`${side}_team`])}</span></>}</button>)}</div>
          {boxTeam === "all" && (payload.stats.length > 0 ? teamStats : <p className="game-tracker-empty">Team statistics will appear when available.</p>)}
          {boxTeam !== "all" && !payload.players.length && <p className="game-tracker-empty">Box scores appear when available.</p>}
          {payload.players.filter(team => boxTeam !== "all" && team.side === boxTeam).map(team => <section key={team.id} className="basketball-box"><h3>{teamDisplayName(game.league, team.name)}</h3>{team.groups.map((group, index) => <div className="basketball-table-scroll" key={index} tabIndex={0} role="region" aria-label={`${teamDisplayName(game.league, team.name)} player statistics`}><table><colgroup><col className="basketball-player-name-column" />{group.labels.map((_, i) => <col className="basketball-player-stat-column" key={i} />)}</colgroup><thead><tr><th scope="col">Players</th>{group.labels.map((label, i) => <th scope="col" key={`${label}-${i}`}>{label}</th>)}</tr></thead><tbody>{group.athletes.map(athlete => <tr key={athlete.id}><th scope="row">{athlete.name}</th>{athlete.stats.map((stat, i) => <td key={i}>{stat}</td>)}</tr>)}</tbody></table></div>)}</section>)}
        </div>}
      </div>
    </section>
  </div>, document.body);
}
