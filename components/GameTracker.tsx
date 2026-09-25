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

  return <div className={`game-tracker-score-team ${side}`} aria-label={`${fullName} ${score ?? "score unavailable"}`}>
    <span className="game-tracker-score-team-name">{shortName}</span>
    <div className="game-tracker-score-team-main">
      <TeamLogo src={team?.logo || fallbackLogo} name={fullName} size={38} />
      <b className={scoreTone}>{score ?? "—"}</b>
    </div>
  </div>;
}

function LiveField({ payload }: { payload: TrackerPayload }) {
  const { situation, teams } = payload;
  const possession = situation.possessionSide ? teams[situation.possessionSide] : null;
  const yardsToGoal = situation.yardsToGoal == null ? 50 : Math.max(0, Math.min(100, situation.yardsToGoal));
  const marker = Math.max(4, Math.min(96, 100 - yardsToGoal));
  const downText = situation.down != null
    ? `${situation.down}${situation.down === 1 ? "st" : situation.down === 2 ? "nd" : situation.down === 3 ? "rd" : "th"} & ${situation.distance != null ? situation.distance : "Goal"}`
    : situation.downDistanceText || "Game situation";

  return <div className="game-tracker-live">
    <div className="game-tracker-live-situation">
      <div>
        <small>{possession ? `${possession.shortName || possession.name} BALL` : "POSSESSION"}</small>
        <strong>{downText}</strong>
        <span>{situation.fieldPosition ? `Ball at ${situation.fieldPosition}` : "Field position updating"}</span>
      </div>
      <div className="game-tracker-timeouts">
        <span>{teams.away.shortName || teams.away.abbreviation || "Away"} TO <b>{situation.awayTimeouts ?? "—"}</b></span>
        <span>{teams.home.shortName || teams.home.abbreviation || "Home"} TO <b>{situation.homeTimeouts ?? "—"}</b></span>
      </div>
    </div>

    <div className={`game-tracker-field ${situation.redZone ? "red-zone" : ""}`.trim()} aria-label={`${downText}, ${situation.fieldPosition || ""}`}>
      <div className="game-tracker-endzone left">END</div>
      <div className="game-tracker-field-lines">{Array.from({ length: 9 }, (_, index) => <i key={index} style={{ left: `${(index + 1) * 10}%` }} />)}</div>
      <div className="game-tracker-yard-labels"><span>10</span><span>20</span><span>30</span><span>40</span><span>50</span><span>40</span><span>30</span><span>20</span><span>10</span></div>
      <div className="game-tracker-ball-marker" style={{ left: `${marker}%` }}>
        {possession ? <TeamLogo src={possession.logo} name={possession.name} size={24} /> : <span>●</span>}
      </div>
      <div className="game-tracker-endzone right">END</div>
    </div>

    <div className="game-tracker-field-footer">
      <span>Own goal line</span>
      <strong>{possession ? `${possession.shortName || possession.name} possession` : "Possession updating"}</strong>
      <span>Opponent end zone</span>
    </div>
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
  const detail = [
    drive.playsCount ? `${drive.playsCount} plays` : "",
    drive.yards != null ? `${drive.yards} yds` : "",
    drive.timeElapsed
  ].filter(Boolean).join(" · ");

  return <summary>
    <span className="game-tracker-drive-logo">{team && <TeamLogo src={team.logo} name={team.name} size={28} />}</span>
    <div>
      <strong>{title}{scoreText}</strong>
      <small className="game-tracker-drive-meta"><span>{detail || drive.description || "Drive summary"}</span>{team && <b>Possession</b>}</small>
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
      {drive.plays.length ? drive.plays.map((play) => <div className="game-tracker-drive-play" key={play.id}>
        <span className="game-tracker-play-time">{[periodLabel(play.period), play.clock].filter(Boolean).join(" · ")}</span>
        <div>
          {play.situation && <small className="game-tracker-play-situation">{play.situation}</small>}
          <strong>{play.text}</strong>
        </div>
        {play.scoringPlay && <b>SCORING</b>}
      </div>) : <p className="game-tracker-drive-empty">No plays listed for this drive.</p>}
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
        <div className="game-tracker-status-line">
          {completed
            ? <strong>FINAL</strong>
            : <><span className="live">LIVE</span><strong>{statusText(payload, game)}</strong></>}
        </div>
        <div className="game-tracker-scoreboard-grid">
          <TeamScore side="away" payload={payload} game={game} completed={completed} />
          <div className="game-tracker-score-divider">AT</div>
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
