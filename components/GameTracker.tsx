"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { ChevronDown, LoaderCircle, X } from "lucide-react";
import type { Game } from "@/lib/types";
import { teamDisplayName } from "@/lib/teamNames";

type TrackerTab = "live" | "scoring" | "plays" | "box";
type Side = "away" | "home";
type BoxView = "all" | Side;

type TrackerPlay = {
  id: string;
  text: string;
  period: string;
  clock: string;
  situation: string;
  teamSide: Side | null;
  scoringPlay: boolean;
  outcome: string;
  homeScore: number | null;
  awayScore: number | null;
};

type TrackerDrive = {
  id: string;
  teamSide: Side | null;
  current: boolean;
  result: string;
  description: string;
  startText: string;
  endText: string;
  timeElapsed: string;
  yards: number | null;
  playsCount: number;
  homeScore: number | null;
  awayScore: number | null;
  plays: TrackerPlay[];
};

type TrackerTeam = {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  logo: string;
  color: string;
  alternateColor: string;
  score: number | null;
};

type TrackerPayload = {
  status: { state: string; detail: string; completed: boolean };
  teams: Record<Side, TrackerTeam>;
  situation: {
    possessionSide: Side | null;
    down: number | null;
    distance: number | null;
    yardsToGoal: number | null;
    fieldPosition: string;
    redZone: boolean;
    downDistanceText: string;
    homeTimeouts: number | null;
    awayTimeouts: number | null;
  };
  scoringPlays: Array<{
    id: string;
    text: string;
    period: string;
    clock: string;
    teamSide: Side | null;
    homeScore: number | null;
    awayScore: number | null;
    type: string;
  }>;
  drives: TrackerDrive[];
  teamStats: Array<{ label: string; away: string; home: string }>;
  playerStats: Array<{
    side: Side;
    category: string;
    title: string;
    labels: string[];
    athletes: Array<{ name: string; values: string[] }>;
  }>;
};

function TeamLogo({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  return src
    ? <Image unoptimized src={src} alt="" width={size} height={size} />
    : <span className="game-tracker-logo-fallback">{name.slice(0, 2).toUpperCase()}</span>;
}

function periodLabel(period: string) {
  const raw = String(period || "").trim();
  const number = Number(raw.match(/\d+/)?.[0]);
  if (Number.isFinite(number)) {
    if (number === 1) return "1st";
    if (number === 2) return "2nd";
    if (number === 3) return "3rd";
    if (number === 4) return "4th";
    if (number > 4) return `${number - 4}OT`;
  }
  if (/ot/i.test(raw)) return raw.toUpperCase();
  return raw || "Game";
}

function drivePeriod(drive: TrackerDrive) {
  return drive.plays.find((play) => play.period)?.period || "";
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

function statusText(payload: TrackerPayload | null, game: Game) {
  if (payload?.status.detail) return payload.status.detail;
  if (game.live_status) return game.live_status;
  return game.live_completed || game.final_home_score != null ? "Final" : "Live";
}

function gameCenterState(payload: TrackerPayload | null, game: Game) {
  const detail = statusText(payload, game);
  const rawPeriod = detail.match(/\b(1st|2nd|3rd|4th|OT|\d+OT)\b/i)?.[1] || "";
  const clock = detail.match(/\b\d{1,2}:\d{2}\b/)?.[0] || "";
  return {
    period: rawPeriod ? periodLabel(rawPeriod) : "Live",
    clock
  };
}

function gameCenterSituation(payload: TrackerPayload | null) {
  if (!payload) return "";
  const situation = payload.situation;
  const direct = String(situation.downDistanceText || "").trim();
  if (direct) {
    if (/\bat\s+/i.test(direct)) return direct.replace(/\s+at\s+/i, " · ");
    return [direct, situation.fieldPosition].filter(Boolean).join(" · ");
  }
  if (situation.down != null) {
    const suffix = situation.down === 1 ? "st" : situation.down === 2 ? "nd" : situation.down === 3 ? "rd" : "th";
    const downDistance = `${situation.down}${suffix} & ${situation.distance != null ? situation.distance : "Goal"}`;
    return [downDistance, situation.fieldPosition].filter(Boolean).join(" · ");
  }
  return situation.fieldPosition || "";
}

function ScoreboardCenter({ payload, game, completed }: { payload: TrackerPayload | null; game: Game; completed: boolean }) {
  const state = gameCenterState(payload, game);
  const situation = completed ? "" : gameCenterSituation(payload);

  if (completed) return <div className="game-tracker-score-center final"><strong>FINAL</strong></div>;

  return <div className="game-tracker-score-center">
    <span className="game-tracker-center-period">{state.period}</span>
    {state.clock && <strong className="game-tracker-center-clock">{state.clock}</strong>}
    {situation && <small>{situation}</small>}
  </div>;
}

function TimeoutDots({ remaining }: { remaining: number | null }) {
  return <span className="game-tracker-timeout-dots" aria-label={remaining == null ? "Timeouts unavailable" : `${remaining} timeouts remaining`}>
    {[0, 1, 2].map((index) => <i key={index} className={remaining != null && index < remaining ? "active" : ""} />)}
  </span>;
}

function TeamScore({ side, payload, game, completed }: { side: Side; payload: TrackerPayload | null; game: Game; completed: boolean }) {
  const fallbackName = teamDisplayName(game.league, side === "away" ? game.away_team : game.home_team);
  const fallbackLogo = side === "away" ? game.away_logo_url : game.home_logo_url;
  const ownFallbackScore = side === "away"
    ? game.live_away_score ?? game.final_away_score
    : game.live_home_score ?? game.final_home_score;
  const opponentFallbackScore = side === "away"
    ? game.live_home_score ?? game.final_home_score
    : game.live_away_score ?? game.final_away_score;
  const team = payload?.teams[side];
  const opponent = payload?.teams[side === "away" ? "home" : "away"];
  const fullName = team?.name || fallbackName;
  const shortName = team?.shortName || fullName;
  const score = team?.score ?? ownFallbackScore;
  const opponentScore = opponent?.score ?? opponentFallbackScore;
  const scoreTone = completed && score != null && opponentScore != null
    ? score > opponentScore ? "winner" : score < opponentScore ? "loser" : ""
    : "";
  const timeouts = payload
    ? side === "away" ? payload.situation.awayTimeouts : payload.situation.homeTimeouts
    : null;

  return <div className={`game-tracker-score-team ${side}`} aria-label={`${fullName} ${score ?? "score unavailable"}`}>
    <span className="game-tracker-score-team-name">{shortName}</span>
    <div className="game-tracker-score-team-main">
      <TeamLogo src={team?.logo || fallbackLogo} name={fullName} size={38} />
      <div className="game-tracker-score-stack">
        <b className={scoreTone}>{score ?? "—"}</b>
        {!completed && <TimeoutDots remaining={timeouts} />}
      </div>
    </div>
  </div>;
}

function FieldFootballIcon() {
  return <span className="game-tracker-field-football" aria-hidden="true">
    <svg viewBox="0 0 24 14" shapeRendering="geometricPrecision">
      <path d="M1.5 7C4.1 3 7.6 1.4 12 1.4S19.9 3 22.5 7c-2.6 4-6.1 5.6-10.5 5.6S4.1 11 1.5 7Z" fill="currentColor" stroke="#62371f" strokeWidth="1.05" />
      <path d="M8.5 7h7M10.5 5.85v2.3M12 5.85v2.3M13.5 5.85v2.3" fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="1.3" />
    </svg>
  </span>;
}

function PlayRow({ play, compact = false }: { play: TrackerPlay; compact?: boolean }) {
  return <div className={`game-tracker-drive-play ${compact ? "compact" : ""}`.trim()}>
    <div>
      <div className="game-tracker-play-context">
        {play.situation && <span>{play.situation}</span>}
        {play.clock && <time>{play.clock}</time>}
      </div>
      <strong>{play.text}</strong>
    </div>
    {play.outcome && <b className="game-tracker-play-outcome">{play.outcome}</b>}
  </div>;
}

function LiveCurrentDrive({ drive, payload }: { drive: TrackerDrive; payload: TrackerPayload }) {
  const team = drive.teamSide ? payload.teams[drive.teamSide] : null;
  const meta = [
    drive.playsCount ? `${drive.playsCount} plays` : "",
    drive.yards != null ? `${drive.yards} yds` : "",
    drive.timeElapsed ? `${drive.timeElapsed} Possession` : "Possession"
  ].filter(Boolean).join(" · ");

  return <section className="game-tracker-live-drive">
    <header>
      <span>{team && <TeamLogo src={team.logo} name={team.name} size={28} />}</span>
      <div><strong>Current Drive</strong><small>{meta}</small></div>
    </header>
    <div className="game-tracker-live-drive-plays">
      {drive.plays.length ? drive.plays.slice(0, 4).map((play) => <PlayRow key={play.id} play={play} compact />) : <p className="game-tracker-drive-empty">Waiting for the first play…</p>}
    </div>
  </section>;
}

function LiveField({ payload }: { payload: TrackerPayload }) {
  const { situation, teams } = payload;
  const currentDrive = payload.drives.find((drive) => drive.current) || (!payload.status.completed ? payload.drives[0] : null);
  const offenseSide = situation.possessionSide || currentDrive?.teamSide || "away";
  const defenseSide: Side = offenseSide === "home" ? "away" : "home";
  const offense = teams[offenseSide];
  const defense = teams[defenseSide];

  const yardsToGoal = situation.yardsToGoal == null ? 50 : Math.max(0, Math.min(100, situation.yardsToGoal));
  const playableLeft = 7;
  const playableWidth = 86;
  const lineOfScrimmage = playableLeft + ((100 - yardsToGoal) / 100) * playableWidth;
  const firstDownYards = situation.distance == null
    ? null
    : Math.max(0, Math.min(situation.distance, yardsToGoal));
  const firstDownLine = firstDownYards == null
    ? null
    : Math.min(playableLeft + playableWidth, lineOfScrimmage + (firstDownYards / 100) * playableWidth);
  const yardLabels = [10, 20, 30, 40, 50, 40, 30, 20, 10];

  return <div className="game-tracker-live">
    <div className="game-tracker-live-meta">
      <div className="game-tracker-possession-label">
        <TeamLogo src={offense.logo} name={offense.name} size={22} />
        <strong>{offense.shortName || offense.name}</strong>
        <span>Ball</span>
      </div>
    </div>

    <div className="game-tracker-field" aria-label={gameCenterSituation(payload)}>
      <div
        className="game-tracker-endzone left"
        style={{ backgroundColor: `#${offense.color || "34444c"}`, color: `#${offense.alternateColor || "ffffff"}` }}
      >
        <TeamLogo src={offense.logo} name={offense.name} size={24} />
        <span>{offense.shortName || offense.abbreviation}</span>
      </div>

      <div className="game-tracker-field-lines">
        {yardLabels.map((_, index) => {
          const left = playableLeft + ((index + 1) * playableWidth / 10);
          return <i key={index} style={{ left: `${left}%` }} />;
        })}
      </div>
      <div className="game-tracker-yard-labels">
        {yardLabels.map((label, index) => {
          const left = playableLeft + ((index + 1) * playableWidth / 10);
          return <span key={index} style={{ left: `${left}%` }}>{label}</span>;
        })}
      </div>

      <div className="game-tracker-los-line" style={{ left: `${lineOfScrimmage}%` }} aria-hidden="true" />
      {firstDownLine != null && <div className="game-tracker-first-down-line" style={{ left: `${firstDownLine}%` }} aria-hidden="true" />}

      <div className="game-tracker-football-position" style={{ left: `${lineOfScrimmage}%` }}>
        <FieldFootballIcon />
      </div>

      <div
        className="game-tracker-endzone right"
        style={{ backgroundColor: `#${defense.color || "34444c"}`, color: `#${defense.alternateColor || "ffffff"}` }}
      >
        <TeamLogo src={defense.logo} name={defense.name} size={24} />
        <span>{defense.shortName || defense.abbreviation}</span>
      </div>
    </div>

    {currentDrive && <LiveCurrentDrive drive={currentDrive} payload={payload} />}
  </div>;
}

function ScoringQuarterHeader({ payload, label }: { payload: TrackerPayload; label: string }) {
  return <div className="game-tracker-quarter-header game-tracker-scoring-quarter-header">
    <span>{label} Quarter</span>
    <div className="game-tracker-quarter-team-logos" aria-hidden="true">
      <TeamLogo src={payload.teams.away.logo} name={payload.teams.away.name} size={20} />
      <TeamLogo src={payload.teams.home.logo} name={payload.teams.home.name} size={20} />
    </div>
  </div>;
}

function ScoringScore({ awayScore, homeScore }: { awayScore: number | null; homeScore: number | null }) {
  return <div className="game-tracker-score-values">
    <b>{awayScore ?? "—"}</b>
    <b>{homeScore ?? "—"}</b>
  </div>;
}

function Scoring({ payload }: { payload: TrackerPayload }) {
  if (!payload.scoringPlays.length) return <p className="game-tracker-empty">No scoring plays yet.</p>;

  return <div className="game-tracker-scoring-list">
    {payload.scoringPlays.map((play, index) => {
      const previous = payload.scoringPlays[index - 1];
      const quarter = periodLabel(play.period);
      const showQuarter = !previous || periodLabel(previous.period) !== quarter;

      return <Fragment key={play.id}>
        {showQuarter && <ScoringQuarterHeader payload={payload} label={quarter} />}
        <div className="game-tracker-score-play">
          <div>
            <small>{[quarter, play.clock, play.type].filter(Boolean).join(" · ")}</small>
            <strong>{play.text}</strong>
          </div>
          <ScoringScore awayScore={play.awayScore} homeScore={play.homeScore} />
        </div>
      </Fragment>;
    })}
  </div>;
}

function DriveSummary({ drive, payload }: { drive: TrackerDrive; payload: TrackerPayload }) {
  const team = drive.teamSide ? payload.teams[drive.teamSide] : null;
  const scored = drive.plays.some((play) => play.scoringPlay);
  const scoreText = scored && (drive.awayScore != null || drive.homeScore != null)
    ? ` (${drive.awayScore ?? "—"}-${drive.homeScore ?? "—"})`
    : "";
  const title = drive.current ? "Current Drive" : drive.result || "Drive";
  const detailParts = [
    drive.playsCount ? `${drive.playsCount} plays` : "",
    drive.yards != null ? `${drive.yards} yds` : ""
  ].filter(Boolean);
  const timeAndPossession = drive.timeElapsed
    ? `${drive.timeElapsed}${team ? " Possession" : ""}`
    : team ? "Possession" : "";
  const detail = [...detailParts, timeAndPossession].filter(Boolean).join(" · ");

  return <summary>
    <span className="game-tracker-drive-logo">{team && <TeamLogo src={team.logo} name={team.name} size={28} />}</span>
    <div>
      <strong>{title}{scoreText}</strong>
      <small className="game-tracker-drive-meta">{detail || drive.description || "Drive summary"}</small>
    </div>
    <ChevronDown size={16} />
  </summary>;
}

function DriveDetails({ drive, payload, initiallyOpen }: { drive: TrackerDrive; payload: TrackerPayload; initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);

  return <details
    className="game-tracker-drive"
    open={open}
    onToggle={(event) => setOpen(event.currentTarget.open)}
  >
    <DriveSummary drive={drive} payload={payload} />
    <div className="game-tracker-drive-plays">
      {drive.plays.length ? drive.plays.map((play) => <PlayRow key={play.id} play={play} />) : <p className="game-tracker-drive-empty">No plays listed for this drive.</p>}
    </div>
  </details>;
}

function Plays({ payload }: { payload: TrackerPayload }) {
  if (!payload.drives.length) return <p className="game-tracker-empty">Drive data is not available yet.</p>;

  return <div className="game-tracker-drives">
    {payload.drives.map((drive, index) => {
      const previous = payload.drives[index - 1];
      const period = periodLabel(drivePeriod(drive));
      const previousPeriod = previous ? periodLabel(drivePeriod(previous)) : "";
      const showQuarter = !previous || period !== previousPeriod;

      return <Fragment key={drive.id}>
        {showQuarter && <div className="game-tracker-quarter-header">{period} Quarter</div>}
        <DriveDetails drive={drive} payload={payload} initiallyOpen={drive.current || index === 0} />
      </Fragment>;
    })}
  </div>;
}

function TeamStats({ payload }: { payload: TrackerPayload }) {
  return <section className="game-tracker-team-stats">
    <div className="game-tracker-stat-table-head">
      <span className="game-tracker-stat-team"><TeamLogo src={payload.teams.away.logo} name={payload.teams.away.name} size={20} /><b>{payload.teams.away.shortName || payload.teams.away.abbreviation || "Away"}</b></span>
      <strong>TEAM STATS</strong>
      <span className="game-tracker-stat-team home"><b>{payload.teams.home.shortName || payload.teams.home.abbreviation || "Home"}</b><TeamLogo src={payload.teams.home.logo} name={payload.teams.home.name} size={20} /></span>
    </div>
    {payload.teamStats.map((stat) => <div className="game-tracker-stat-row" key={stat.label}>
      <strong>{stat.away}</strong>
      <span>{stat.label}</span>
      <strong>{stat.home}</strong>
    </div>)}
  </section>;
}

function PlayerTable({ row }: { row: TrackerPayload["playerStats"][number] }) {
  const visibleLabels = row.labels;
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;

    let startX = 0;
    let startY = 0;
    const touchStart = (event: TouchEvent) => {
      startX = event.touches[0]?.clientX || 0;
      startY = event.touches[0]?.clientY || 0;
    };
    const touchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      if (Math.abs(deltaX) <= Math.abs(deltaY)) return;

      const atLeft = element.scrollLeft <= 0;
      const atRight = Math.ceil(element.scrollLeft + element.clientWidth) >= element.scrollWidth;
      if ((atLeft && deltaX > 0) || (atRight && deltaX < 0)) event.preventDefault();
    };

    element.addEventListener("touchstart", touchStart, { passive: true });
    element.addEventListener("touchmove", touchMove, { passive: false });
    return () => {
      element.removeEventListener("touchstart", touchStart);
      element.removeEventListener("touchmove", touchMove);
    };
  }, []);

  return <div ref={scroller} className="game-tracker-player-table-scroll">
    <table className="game-tracker-player-table">
      <thead><tr><th>Player</th>{visibleLabels.map((label) => <th key={label}>{label}</th>)}</tr></thead>
      <tbody>{row.athletes.map((athlete) => <tr key={athlete.name}>
        <td>{athlete.name}</td>
        {visibleLabels.map((_, index) => <td key={index}>{athlete.values[index] ?? "—"}</td>)}
      </tr>)}</tbody>
    </table>
  </div>;
}

function TeamBox({ payload, side }: { payload: TrackerPayload; side: Side }) {
  const team = payload.teams[side];
  const rows = payload.playerStats.filter((item) => item.side === side);

  return <div className="game-tracker-team-box">
    <div className="game-tracker-team-box-heading">
      <TeamLogo src={team.logo} name={team.name} size={30} />
      <strong>{team.name}</strong>
    </div>
    {rows.length ? rows.map((row) => <section className="game-tracker-box-section" key={row.category}>
      <h3>{row.title}</h3>
      <PlayerTable row={row} />
    </section>) : <p className="game-tracker-empty">Player box score is not available yet.</p>}
  </div>;
}

function BoxScore({ payload }: { payload: TrackerPayload }) {
  const [view, setView] = useState<BoxView>("all");

  return <div className="game-tracker-box">
    <div className="game-tracker-box-selector" role="group" aria-label="Choose box score team">
      <button type="button" className={view === "away" ? "active" : ""} onClick={() => setView("away")}>{payload.teams.away.shortName || payload.teams.away.abbreviation || "Away"}</button>
      <button type="button" className={view === "all" ? "active" : ""} onClick={() => setView("all")}>All</button>
      <button type="button" className={view === "home" ? "active" : ""} onClick={() => setView("home")}>{payload.teams.home.shortName || payload.teams.home.abbreviation || "Home"}</button>
    </div>
    {view === "all" ? <TeamStats payload={payload} /> : <TeamBox payload={payload} side={view} />}
  </div>;
}

export default function GameTracker({ game, onClose }: { game: Game; onClose: () => void }) {
  const finalAtOpen = Boolean(game.live_completed || (game.final_home_score != null && game.final_away_score != null));
  const [tab, setTab] = useState<TrackerTab>(finalAtOpen ? "scoring" : "live");
  const [payload, setPayload] = useState<TrackerPayload | null>(null);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const sheet = useRef<HTMLElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
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
    const inertStates = siblings.map((node) => node.inert);
    siblings.forEach((node) => { node.inert = true; });
    sheet.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = priorOverflow;
      siblings.forEach((node, index) => { node.inert = inertStates[index]; });
      priorFocus?.focus();
    };
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const element = scrollArea.current;
    if (!element) return;

    let startX = 0;
    let startY = 0;
    const touchStart = (event: TouchEvent) => {
      startX = event.touches[0]?.clientX || 0;
      startY = event.touches[0]?.clientY || 0;
    };
    const touchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      if (Math.abs(deltaY) <= Math.abs(deltaX)) return;
      const atTop = element.scrollTop <= 0;
      const atBottom = Math.ceil(element.scrollTop + element.clientHeight) >= element.scrollHeight;
      if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) event.preventDefault();
    };

    element.addEventListener("touchstart", touchStart, { passive: true });
    element.addEventListener("touchmove", touchMove, { passive: false });
    return () => {
      element.removeEventListener("touchstart", touchStart);
      element.removeEventListener("touchmove", touchMove);
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
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [game.id]);

  if (!mounted) return null;

  const awayName = teamDisplayName(game.league, game.away_team);
  const homeName = teamDisplayName(game.league, game.home_team);
  const tabs: Array<[TrackerTab, string]> = [["live", "Live"], ["scoring", "Scoring"], ["plays", "Plays"], ["box", "Box Score"]];
  const completed = Boolean(payload?.status.completed ?? game.live_completed ?? (game.final_home_score != null && game.final_away_score != null));

  return createPortal(<div className="game-tracker-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={sheet} className="game-tracker-sheet" role="dialog" aria-modal="true" aria-label={`${awayName} at ${homeName} GameTracker`}>
      <header className="game-tracker-header">
        <span>GAMETRACKER</span>
        <button type="button" onClick={onClose} aria-label="Close GameTracker"><X size={20} /></button>
      </header>

      <div className="game-tracker-scoreboard">
        <div className="game-tracker-scoreboard-grid">
          <TeamScore side="away" payload={payload} game={game} completed={completed} />
          <ScoreboardCenter payload={payload} game={game} completed={completed} />
          <TeamScore side="home" payload={payload} game={game} completed={completed} />
        </div>
      </div>

      <nav className="game-tracker-tabs" aria-label="GameTracker sections">
        {tabs.map(([id, label]) => <button
          type="button"
          key={id}
          className={tab === id ? "active" : ""}
          aria-current={tab === id ? "page" : undefined}
          onClick={() => {
            setTab(id);
            scrollArea.current?.scrollTo(0, 0);
          }}
        >{label}</button>)}
      </nav>

      <div ref={scrollArea} className="game-tracker-scroll">
        {!payload && !error && <div className="game-tracker-loading"><LoaderCircle size={22} /><span>Loading GameTracker…</span></div>}
        {error && !payload && <div className="game-tracker-empty" role="alert">{error}</div>}
        {payload && tab === "live" && <LiveField payload={payload} />}
        {payload && tab === "scoring" && <Scoring payload={payload} />}
        {payload && tab === "plays" && <Plays payload={payload} />}
        {payload && tab === "box" && <BoxScore payload={payload} />}
      </div>
    </section>
  </div>, document.body);
}
