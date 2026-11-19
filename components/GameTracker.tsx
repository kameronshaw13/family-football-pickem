"use client";

import useGameSheetDismiss from "@/hooks/useGameSheetDismiss";
import { trackerPeriodLabel, trackerPeriodHeading } from "@/lib/trackerPeriods";
import { playTextWithoutDuplicateClock } from "@/lib/playText";


import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "@/components/TeamImage";
import { createPortal } from "react-dom";
import { ChevronDown, LoaderCircle } from "lucide-react";
import GameDetailClose from "@/components/GameDetailClose";
import type { Game } from "@/lib/types";
import type { AppSlug } from "@/lib/rulePresentation";
import { teamDisplayName } from "@/lib/teamNames";
import { trackerDisplayScore } from "@/lib/trackerDisplayScore";
import { trackerTeamColors } from "@/lib/trackerTeamColors";
import { groupTrackerScoringPlays } from "@/lib/trackerScoringGroups";

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
  endZoneName: string;
  logo: string;
  color: string;
  alternateColor: string;
  score: number | null;
  record?: string;
};

type TrackerPayload = {
  league: "NFL" | "CFB";
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
    drive?: { playsCount: number; yards: number | null; timeElapsed: string } | null;
  }>;
  drives: TrackerDrive[];
  teamStats: Array<{ label: string; away: string; home: string }>;
  playerStats: Array<{
    side: Side;
    category: string;
    title: string;
    labels: string[];
    athletes: Array<{ name: string; values: string[] }>;
    totals?: string[];
  }>;
};

function TeamLogo({ src, name, size = 40, logoBackground }: { src?: string | null; name: string; size?: number; logoBackground?: string }) {
  return src
    ? <Image unoptimized src={src} alt="" width={size} height={size} logoBackground={logoBackground} />
    : <span className="game-tracker-logo-fallback">{name.slice(0, 2).toUpperCase()}</span>;
}

function periodLabel(period: string) {
  return trackerPeriodLabel(period);
}

async function loadTracker(gameId: string, appSlug: AppSlug) {
  const token = window.localStorage.getItem("pickem_session_token") || "";
  const response = await fetch(`/api/game-tracker?gameId=${encodeURIComponent(gameId)}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "x-pickem-group": appSlug },
    cache: "no-store"
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Could not load GameTracker.");
  return payload as TrackerPayload;
}

function statusText(payload: TrackerPayload | null, game: Game) {
  // Use the Pick Board's actively refreshed game clock before the slower
  // detail/summary feed when the two sources disagree.
  if (game.live_state === "in" && game.live_status) return game.live_status;
  if (payload?.status.detail) return payload.status.detail;
  if (game.live_status) return game.live_status;
  return game.live_completed || game.final_home_score != null ? "Final" : "Live";
}

function gameCenterState(payload: TrackerPayload | null, game: Game) {
  const detail = statusText(payload, game);
  const rawPeriod = detail.match(/\b(1st|2nd|3rd|4th|OT|\d+OT)\b/i)?.[1] || detail.match(/\b(?:Quarter|Q)\s*([1-4])\b/i)?.[1] || "";
  const clock = detail.match(/\b\d{1,2}:\d{2}\b/)?.[0] || "";
  return {
    period: rawPeriod ? periodLabel(rawPeriod) : "Live",
    clock
  };
}

function gameCenterSituation(payload: TrackerPayload | null) {
  if (!payload) return "";
  const situation = payload.situation;
  const redZonePosition = (position: string) => position
    ? `${position}${situation.redZone ? " in Red" : ""}`
    : situation.redZone ? "Red Zone" : "";

  // In the red zone, keep the top header focused on field position only.
  // Down/distance still remains available in the live play/drive details.
  if (situation.redZone) return redZonePosition(situation.fieldPosition);

  const direct = String(situation.downDistanceText || "").trim();
  if (direct) {
    const atMatch = direct.match(/^(.*?)\s+at\s+(.+)$/i);
    if (atMatch) return [atMatch[1], redZonePosition(atMatch[2])].filter(Boolean).join(" · ");
    return [direct, redZonePosition(situation.fieldPosition)].filter(Boolean).join(" · ");
  }
  if (situation.down != null) {
    const suffix = situation.down === 1 ? "st" : situation.down === 2 ? "nd" : situation.down === 3 ? "rd" : "th";
    const downDistance = `${situation.down}${suffix} & ${situation.distance != null ? situation.distance : "Goal"}`;
    return [downDistance, redZonePosition(situation.fieldPosition)].filter(Boolean).join(" · ");
  }
  return redZonePosition(situation.fieldPosition);
}

function ScoreboardCenter({ payload, game, completed }: { payload: TrackerPayload | null; game: Game; completed: boolean }) {
  const state = gameCenterState(payload, game);
  const situation = completed ? "" : (game.live_situation?.trim() || gameCenterSituation(payload));

  if (completed) return <div className="game-tracker-score-center final"><time className="broadcast-game-date" dateTime={game.commence_time}>{new Date(game.commence_time).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Chicago" })}</time><strong>FINAL</strong></div>;
  const pregame = (payload?.status.state || game.live_state || "pre") === "pre";
  if (pregame) return <div className="game-tracker-score-center football-kickoff">
    <span>KICKOFF</span>
    <strong>{new Date(game.commence_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}</strong>
    <small>CT</small>
  </div>;

  return <div className="game-tracker-score-center">
    <span className="game-tracker-center-period">{state.period}</span>
    {state.clock && <strong className="game-tracker-center-clock">{state.clock}</strong>}
    {situation && <small className={payload?.situation.redZone ? "game-tracker-red-zone-position" : ""}>{payload?.situation.redZone ? (payload.situation.fieldPosition || "Red Zone") : situation}</small>}
  </div>;
}

function TimeoutDots({ remaining }: { remaining: number | null }) {
  return <span className="game-tracker-timeout-dots" aria-label={remaining == null ? "Timeouts unavailable" : `${remaining} timeouts remaining`}>
    {[0, 1, 2].map((index) => <i key={index} className={remaining != null && index < remaining ? "active" : ""} />)}
  </span>;
}

function MetaDots({ items }: { items: string[] }) {
  return <>{items.filter(Boolean).map((item, index) => <Fragment key={`${item}-${index}`}>
    {index > 0 && <span className="game-tracker-meta-dot" aria-hidden="true" />}
    <span>{item}</span>
  </Fragment>)}</>;
}

function trackerTeamLabel(team: TrackerTeam) {
  const label = team.shortName || team.name || team.abbreviation;
  return label.length > 14 && team.abbreviation ? team.abbreviation : label;
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
  // The saved game artwork is canonical, so opening GameTracker never swaps variants.
  const logo = fallbackLogo || team?.logo;
  const logoBacking = trackerTeamColors(team?.color, team?.alternateColor).backing;
  // Live game props are refreshed by the Pick Board every five seconds.
  // ESPN's detail summary sometimes lags its scoreboard event feed.
  const liveBoardScore = game.live_state === "in"
    ? side === "away" ? game.live_away_score : game.live_home_score
    : null;
  const liveOpponentScore = game.live_state === "in"
    ? side === "away" ? game.live_home_score : game.live_away_score
    : null;
  const score = trackerDisplayScore(completed, game.live_state === "in",
    side === "away" ? game.final_away_score : game.final_home_score, liveBoardScore, team?.score ?? null, ownFallbackScore);
  const opponentScore = trackerDisplayScore(completed, game.live_state === "in",
    side === "away" ? game.final_home_score : game.final_away_score, liveOpponentScore, opponent?.score ?? null, opponentFallbackScore);
  const scoreTone = completed && score != null && opponentScore != null
    ? score > opponentScore ? "winner" : score < opponentScore ? "loser" : ""
    : "";
  const timeouts = payload
    ? side === "away" ? payload.situation.awayTimeouts : payload.situation.homeTimeouts
    : null;

  return <div className={`game-tracker-score-team ${side}`} aria-label={`${fullName} ${score ?? "score unavailable"}`}>
    <span className="football-team-watermark" aria-hidden="true">{fullName}</span>
    <div className="game-tracker-score-team-main">
      <span className="game-tracker-header-logo-wrap">{logo
        ? <Image unoptimized src={logo} alt="" width={56} height={56} scoreboardLeague={game.league} style={{ "--tracker-logo-backing": logoBacking } as CSSProperties} />
        : <TeamLogo name={fullName} size={56} />}</span>
      <div className="game-tracker-score-stack">
        <small className="broadcast-team-record">{team?.record || ""}</small>
        <b className={scoreTone}>{score ?? "—"}</b>
        {!completed && (payload?.status.state === "in" || game.live_state === "in") && <div className="game-tracker-team-indicators"><TimeoutDots remaining={timeouts} />{payload?.situation.possessionSide === side && <FieldFootballIcon />}</div>}
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

function PlayRow({ play, team, compact = false }: { play: TrackerPlay; team?: TrackerTeam | null; compact?: boolean }) {
  // The ESPN description sometimes includes the start clock; don't show it twice.
  const raw = playTextWithoutDuplicateClock(play.text, play.clock);
  const timeMatch = raw.match(/^\s*\(?(\d{1,2}:\d{2})\)?(?=\s|$)[\s:–—-]*/);
  const startClock = timeMatch?.[1] || play.clock;
  const endClock = timeMatch && play.clock && timeMatch[1] !== play.clock ? play.clock : "";
  const description = timeMatch ? raw.slice(timeMatch[0].length).trimStart() : raw;

  return <div className={`football-play-row${compact ? " compact" : ""}`}>
    <span className="football-play-row-logo" aria-hidden="true">{team && <TeamLogo src={team.logo} name={team.name} size={23} />}</span>
    <div className="football-play-row-copy">
      {play.situation && <div className="football-play-row-situation">{play.situation}</div>}
      <p>{startClock && <time>{startClock}</time>}{description}{endClock && <time className="football-play-end-clock"> – {endClock}</time>}</p>
    </div>
    {play.outcome && <span className="football-play-row-outcome">{play.outcome}</span>}
  </div>;
}

function LiveField({ payload }: { payload: TrackerPayload }) {
  const { situation, teams } = payload;
  const recent = payload.drives.flatMap(drive => drive.plays).slice(0, 5);
  const latest = recent[0];
  const currentDrive = payload.drives.find(drive => drive.current) || payload.drives[0];
  const offenseSide = situation.possessionSide || currentDrive?.teamSide || "away";
  const defenseSide: Side = offenseSide === "home" ? "away" : "home";
  const offense = teams[offenseSide];
  const defense = teams[defenseSide];
  const latestTeam = latest?.teamSide ? teams[latest.teamSide] : null;

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

  return <div className="game-tracker-live football-live-view">
    <div className="football-latest-action">
      <span className="football-latest-action-logo" aria-hidden="true">{latestTeam && <TeamLogo src={latestTeam.logo} name={latestTeam.name} size={25} />}</span>
      <div>
        <small>{latest ? "Latest Play" : "On the Field"}</small>
        <strong>{latest ? playTextWithoutDuplicateClock(latest.text, latest.clock) : payload.status.state === "pre" ? "Play-by-play begins at kickoff." : "Waiting for the next play."}</strong>
        {latest?.situation && <span>{latest.situation}{latest.clock ? ` · ${latest.clock}` : ""}</span>}
      </div>
    </div>

    {payload.status.state !== "pre" && <div className="game-tracker-live-meta">
      <div className="game-tracker-possession-label">
        <TeamLogo src={offense.logo} name={offense.name} size={22} />
        <strong>{payload.league === "NFL" ? offense.shortName : teamDisplayName("CFB", offense.name || offense.shortName)}</strong>
        <span>Possession</span>
      </div>
      {situation.downDistanceText && <span className="football-live-down-distance">{situation.downDistanceText}</span>}
    </div>}

    <div className="game-tracker-field" aria-label={gameCenterSituation(payload)}>
      <div className="game-tracker-endzone left"
        style={{ backgroundColor: `#${offense.color || "34444c"}`, color: `#${offense.alternateColor || "ffffff"}` }}>
        <TeamLogo src={offense.logo} name={offense.name} size={20} logoBackground={`#${offense.color || "34444c"}`} />
        <span>{offense.endZoneName || offense.shortName || offense.abbreviation}</span>
      </div>
      <div className="game-tracker-field-lines">
        {yardLabels.map((_, index) => <i key={index} style={{ left: `${playableLeft + ((index + 1) * playableWidth / 10)}%` }} />)}
      </div>
      <div className="game-tracker-yard-labels">
        {yardLabels.map((label, index) => <span key={index} style={{ left: `${playableLeft + ((index + 0.5) * playableWidth / 10)}%` }}>{label}</span>)}
      </div>
      {payload.status.state !== "pre" && situation.yardsToGoal != null && <>
        <div className="game-tracker-los-line" style={{ left: `${lineOfScrimmage}%` }} aria-hidden="true" />
        {firstDownLine != null && <div className="game-tracker-first-down-line" style={{ left: `${firstDownLine}%` }} aria-hidden="true" />}
        <div className="game-tracker-football-position" style={{ left: `${lineOfScrimmage}%` }}><FieldFootballIcon /></div>
      </>}
      <div className="game-tracker-endzone right"
        style={{ backgroundColor: `#${defense.color || "34444c"}`, color: `#${defense.alternateColor || "ffffff"}` }}>
        <TeamLogo src={defense.logo} name={defense.name} size={20} logoBackground={`#${defense.color || "34444c"}`} />
        <span>{defense.endZoneName || defense.shortName || defense.abbreviation}</span>
      </div>
    </div>

    <section className="football-recent-plays" aria-label="Recent football plays">
      <div className="football-section-heading"><h3>Last 5 Plays</h3></div>
      {recent.length ? recent.map(play => <PlayRow key={play.id} play={play} team={play.teamSide ? teams[play.teamSide] : null} compact />)
        : <p className="game-tracker-empty">No plays available yet.</p>}
    </section>
  </div>;
}

function ScoringQuarterHeader({ payload, label }: { payload: TrackerPayload; label: string }) {
  return <div className="game-tracker-quarter-header game-tracker-scoring-quarter-header">
    <span>{trackerPeriodHeading(label)}</span>
    <div className="game-tracker-quarter-team-logos" aria-hidden="true">
      <TeamLogo src={payload.teams.away.logo} name={payload.teams.away.name} size={20} />
      <TeamLogo src={payload.teams.home.logo} name={payload.teams.home.name} size={20} />
    </div>
  </div>;
}

function ScoringScore({
  play,
  previous
}: {
  play: TrackerPayload["scoringPlays"][number];
  previous?: TrackerPayload["scoringPlays"][number];
}) {
  const awayChanged = previous
    ? play.awayScore != null && play.awayScore !== previous.awayScore
    : play.teamSide === "away";
  const homeChanged = previous
    ? play.homeScore != null && play.homeScore !== previous.homeScore
    : play.teamSide === "home";
  return <div className="game-tracker-score-values">
    <b className={awayChanged ? "changed" : "unchanged"}>{play.awayScore ?? "—"}</b>
    <b className={homeChanged ? "changed" : "unchanged"}>{play.homeScore ?? "—"}</b>
  </div>;
}

function FootballGameFlow({ payload }: { payload: TrackerPayload }) {
  const plays = payload.scoringPlays.filter(play => play.awayScore != null && play.homeScore != null);
  if (plays.length < 2) return null;
  const scores = [{ away: 0, home: 0 }, ...plays.map(play => ({ away: Number(play.awayScore), home: Number(play.homeScore) }))];
  const maximum = Math.ceil(Math.max(10, ...scores.flatMap(score => [score.away, score.home])) / 7) * 7;
  const x = (index: number) => 36 + index * 276 / (scores.length - 1);
  const y = (points: number) => 136 - points / maximum * 116;
  const path = (side: Side) => scores.map((score, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(2)} ${y(score[side]).toFixed(2)}`).join(" ");
  return <section className="basketball-score-flow tracker-football-flow" aria-label="Football game flow">
    <h3>Game Flow</h3>
    <svg viewBox="0 0 330 164" role="img" aria-label={`Cumulative football scores: ${payload.teams.away.name} solid and ${payload.teams.home.name} dashed.`}>
      {[0,1,2,3,4].map(tick => { const value = Math.round(maximum * tick / 4); const sy = y(value); return <g key={tick}><line x1="36" y1={sy} x2="312" y2={sy} className="basketball-flow-grid" /><text x="28" y={sy + 3} textAnchor="end" className="basketball-flow-axis">{value}</text></g>; })}
      <path d={path("away")} className="basketball-flow-away" />
      <path d={path("home")} className="basketball-flow-home" />
      {["Q1","Q2","Q3","Q4"].map((label,index) => <text key={label} x={36 + (index + .5) * 276 / 4} y="154" textAnchor="middle" className="basketball-flow-axis">{label}</text>)}
    </svg>
    <div className="basketball-flow-legend"><span><TeamLogo src={payload.teams.away.logo} name={payload.teams.away.name} size={19} /><i className="basketball-flow-legend-line away" />{payload.teams.away.shortName}</span><span><TeamLogo src={payload.teams.home.logo} name={payload.teams.home.name} size={19} /><i className="basketball-flow-legend-line home" />{payload.teams.home.shortName}</span></div>
  </section>;
}

function Scoring({ payload }: { payload: TrackerPayload }) {
  if (!payload.scoringPlays.length) return <p className="game-tracker-empty">No scoring plays yet.</p>;

  // A quarter owns its header and rows. This makes the dividers deterministic:
  // header-to-first-row, row-to-row, and quarter-to-quarter each draw once.
  const quarters = groupTrackerScoringPlays(payload.scoringPlays, periodLabel);
  return <div className="game-tracker-scoring-list">
    <FootballGameFlow payload={payload} />
    {quarters.map((quarter, quarterIndex) => <section
      className="game-tracker-scoring-quarter"
      aria-label={`${trackerPeriodHeading(quarter.label)} scoring`}
      key={`${quarter.label}-${quarterIndex}`}
    >
      <ScoringQuarterHeader payload={payload} label={quarter.label} />
      {quarter.rows.map(({ play, previous }) => <div className="game-tracker-score-play football-score-event" key={play.id}>
        <span className="football-play-row-logo" aria-hidden="true">{play.teamSide && <TeamLogo src={payload.teams[play.teamSide].logo} name={payload.teams[play.teamSide].name} size={23} />}</span>
        <div className="game-tracker-scoring-copy">
          <div className="game-tracker-scoring-meta">
            <strong>{play.type || "Score"}</strong>
            {play.clock && <time>{play.clock}</time>}
          </div>
          <p>{playTextWithoutDuplicateClock(play.text, play.clock)}</p>
          {play.drive && <small><MetaDots items={[
            play.drive.playsCount ? `${play.drive.playsCount} plays` : "",
            play.drive.yards != null ? `${play.drive.yards} yds` : "",
            play.drive.timeElapsed ? `${play.drive.timeElapsed} possession` : ""
          ].filter(Boolean)} /></small>}
        </div>
        <ScoringScore play={play} previous={previous} />
      </div>)}
    </section>)}
  </div>;
}

function FootballDrive({ drive, payload, initiallyOpen }: {
  drive: TrackerDrive;
  payload: TrackerPayload;
  initiallyOpen: boolean;
}) {
  const team = drive.teamSide ? payload.teams[drive.teamSide] : null;
  const result = drive.current ? "Current Drive" : drive.result || "Drive";
  const meta = [
    drive.playsCount ? `${drive.playsCount} plays` : "",
    drive.yards != null ? `${drive.yards} yds` : "",
    drive.timeElapsed ? `${drive.timeElapsed} possession` : ""
  ].filter(Boolean);

  return <details className="football-drive" defaultOpen={initiallyOpen}>
    <summary className="football-drive-summary">
      <span className="football-drive-logo" aria-hidden="true">{team && <TeamLogo src={team.logo} name={team.name} size={26} />}</span>
      <span className="football-drive-description">
        <strong>{team ? `${team.shortName || team.name} · ${result}` : result}</strong>
        <small>{meta.length ? <MetaDots items={meta} /> : drive.description || "Drive summary"}</small>
      </span>
      <ChevronDown className="football-drive-chevron" size={17} aria-hidden="true" />
    </summary>
    <div className="football-drive-plays">
      {drive.plays.length ? drive.plays.map((play, index) => {
        const prior = drive.plays[index - 1];
        const crossedQuarter = prior?.period && play.period && periodLabel(prior.period) !== periodLabel(play.period);
        return <Fragment key={play.id}>
          {crossedQuarter && <ScoringQuarterHeader payload={payload} label={periodLabel(play.period)} />}
          <PlayRow play={play} team={play.teamSide ? payload.teams[play.teamSide] : null} />
        </Fragment>;
      }) : <p className="game-tracker-drive-empty">Play details are not available yet.</p>}
    </div>
  </details>;
}

function Plays({ payload }: { payload: TrackerPayload }) {
  if (!payload.drives.length) return <p className="game-tracker-empty">Drive data is not available yet.</p>;

  // ESPN returns chronological drives after the final whistle and newest-first drives while live.
  // Group each drive by its start quarter, even if the drive spans two quarters.
  const quarterForDrive = (drive: TrackerDrive) => {
    const startPlay = payload.status.completed ? drive.plays[0] : drive.plays[drive.plays.length - 1];
    return periodLabel(startPlay?.period || "1");
  };
  const quarters = payload.drives.reduce<Array<{ label: string; drives: TrackerDrive[] }>>((groups, drive) => {
    const label = quarterForDrive(drive);
    const last = groups[groups.length - 1];
    if (!last || last.label !== label) groups.push({ label, drives: [drive] });
    else last.drives.push(drive);
    return groups;
  }, []);

  return <div className="football-play-list">
    {quarters.map((quarter, quarterIndex) => <section className="football-play-period" key={`${quarter.label}-${quarterIndex}`}>
      <ScoringQuarterHeader payload={payload} label={quarter.label} />
      {quarter.drives.map((drive, driveIndex) => <FootballDrive
        key={drive.id}
        drive={drive}
        payload={payload}
        initiallyOpen={drive.current || (quarterIndex === 0 && driveIndex === 0)}
      />)}
    </section>)}
  </div>;
}

function TeamStats({ payload }: { payload: TrackerPayload }) {
  const awayLabel = payload.league === "NFL" ? (payload.teams.away.shortName || "Away") : teamDisplayName("CFB", payload.teams.away.name || payload.teams.away.shortName || "Away");
  const homeLabel = payload.league === "NFL" ? (payload.teams.home.shortName || "Home") : teamDisplayName("CFB", payload.teams.home.name || payload.teams.home.shortName || "Home");

  return <section className="game-tracker-team-stats" aria-label="Team box score comparison">
    {payload.teamStats.length ? payload.teamStats.map((stat) => <div className="game-tracker-stat-row" key={stat.label}>
      <strong aria-label={`${awayLabel} ${stat.label}: ${stat.away}`}>{stat.away}</strong>
      <span>{stat.label}</span>
      <strong aria-label={`${homeLabel} ${stat.label}: ${stat.home}`}>{stat.home}</strong>
    </div>) : <p className="game-tracker-empty">Team statistics will appear when available.</p>}
  </section>;
}

function compactPlayerName(name: string) {
  const parts = name.trim().split(/\\s+/);
  if (parts.length < 2 || /^[A-Z]\\.$/.test(parts[0])) return name;
  return `${parts[0].charAt(0)}. ${parts.slice(1).join(" ")}`;
}

function PlayerTable({ row }: { row: TrackerPayload["playerStats"][number] }) {
  const targetsIndex = row.category.includes("receiv") ? row.labels.findIndex((label) => /^(TGT|TGTS|TARGETS?)$/i.test(label)) : -1;
  const labelOrder = row.labels.map((_, index) => index);
  if (targetsIndex > 0) labelOrder.unshift(labelOrder.splice(targetsIndex, 1)[0]);
  const visibleLabels = labelOrder.map((index) => row.labels[index]);
  const scroller = useRef<HTMLDivElement>(null);
  const displayNames = row.athletes.map((athlete) => compactPlayerName(athlete.name));
  // Reserve just enough for the widest unwrapped name; the remaining space is
  // divided evenly across stat columns with no blank right-hand gutter.
  const nameColumnWidth = Math.max(94, Math.min(190, Math.ceil(Math.max(row.title.length, ...displayNames.map((name) => name.length)) * 6.5 + 12)));
  const minTableWidth = nameColumnWidth + visibleLabels.length * 34;
  const showTeamTotals = row.athletes.length > 1;

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

  return <div ref={scroller} className="game-tracker-player-table-scroll" tabIndex={0} role="region" aria-label={`${row.title} player statistics, scroll horizontally for more columns`}>
    <table className="game-tracker-player-table" aria-label={row.title} style={{ width: "100%", minWidth: `${minTableWidth}px` }}>
      <colgroup><col style={{ width: nameColumnWidth }} />{visibleLabels.map((label, index) => <col key={`${label}-${index}`} />)}</colgroup>
      <thead><tr><th scope="col">{row.title.replace(/\b(Kick|Punt)\s*Returns?\b/gi, (_match, kind: string) => `${kind} Return`)}</th>{visibleLabels.map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>{row.athletes.map((athlete, athleteIndex) => <tr key={athlete.name}>
        <th scope="row" title={athlete.name}>{displayNames[athleteIndex]}</th>
        {visibleLabels.map((_, index) => <td key={index}>{athlete.values[labelOrder[index]] ?? "—"}</td>)}
      </tr>)}
      {showTeamTotals && <tr className="game-tracker-team-total"><th scope="row">Team</th>{visibleLabels.map((_, index) => <td key={index}>{row.totals?.[labelOrder[index]] ?? "—"}</td>)}</tr>}
      </tbody>
    </table>
  </div>;
}

function TeamBox({ payload, side }: { payload: TrackerPayload; side: Side }) {
  const rows = payload.playerStats.filter((item) => item.side === side);

  return <div className="game-tracker-team-box">
    {rows.length ? rows.map((row) => <section className="game-tracker-box-section" key={row.category}>
      <PlayerTable row={row} />
    </section>) : <p className="game-tracker-empty">Player box score is not available yet.</p>}
  </div>;
}

function FootballLineScore({ payload }: { payload: TrackerPayload }) {
  // ESPN provides cumulative scoring plays; calculate each quarter's points
  // from the last known score while carrying zero-point quarters forward.
  const periods = ["1st", "2nd", "3rd", "4th"];
  const points = periods.map(period => {
    const matching = payload.scoringPlays.filter(play => trackerPeriodLabel(play.period) === period);
    const latest = matching[matching.length - 1];
    return latest ? { away: latest.awayScore, home: latest.homeScore } : null;
  });
  const scoreAt = (side: Side, index: number) => {
    for (let j = index; j >= 0; j--) {
      const score = points[j]?.[side];
      if (score != null) return score;
    }
    return 0;
  };
  const regulation = periods.map((period, index) => ({
    period: String(index + 1),
    away: scoreAt("away", index) - (index === 0 ? 0 : scoreAt("away", index - 1)),
    home: scoreAt("home", index) - (index === 0 ? 0 : scoreAt("home", index - 1))
  }));
  const overtime = payload.scoringPlays.filter(play => /OT/i.test(trackerPeriodLabel(play.period)));
  const otPeriods = [...new Set(overtime.map(play => trackerPeriodLabel(play.period)))].sort();
  let previousAway = scoreAt("away", 3), previousHome = scoreAt("home", 3);
  const extras = otPeriods.map(period => {
    const plays = overtime.filter(play => trackerPeriodLabel(play.period) === period);
    const last = plays[plays.length - 1];
    const away = (last.awayScore ?? previousAway) - previousAway;
    const home = (last.homeScore ?? previousHome) - previousHome;
    previousAway += away;
    previousHome += home;
    return { period, away, home };
  });
  const columns = [...regulation, ...extras];
  return <div className="basketball-linescore-scroll football-linescore" role="region" aria-label="Football scoring by quarter" tabIndex={0}>
    <table className="basketball-linescore"><thead><tr><th scope="col">Team</th>
      {columns.map(row => <th key={row.period} scope="col">{row.period}</th>)}<th scope="col">T</th>
    </tr></thead><tbody>{(["away", "home"] as const).map(side =>
      <tr key={side}><th scope="row"><TeamLogo src={payload.teams[side].logo} name={payload.teams[side].name} size={23} />
        <span>{payload.teams[side].abbreviation || payload.teams[side].shortName}</span></th>
        {columns.map(row => <td key={row.period}>{row[side]}</td>)}
        <td className="basketball-linescore-total">{payload.teams[side].score ?? "—"}</td>
      </tr>)}</tbody></table>
  </div>;
}

function BoxScore({ payload }: { payload: TrackerPayload }) {
  const [view, setView] = useState<BoxView>("all");

  return <div className="game-tracker-box">
    <FootballLineScore payload={payload} />
    <div className="game-tracker-box-selector" role="group" aria-label="Choose box score team">
      <button type="button" className={view === "away" ? "active" : ""} aria-pressed={view === "away"} onClick={() => setView("away")}><TeamLogo src={payload.teams.away.logo} name={payload.teams.away.name} size={20} /><span>{payload.league === "NFL" ? payload.teams.away.shortName : teamDisplayName("CFB", payload.teams.away.name || payload.teams.away.shortName)}</span></button>
      <button type="button" className={view === "all" ? "active" : ""} aria-pressed={view === "all"} onClick={() => setView("all")}>Team</button>
      <button type="button" className={view === "home" ? "active" : ""} aria-pressed={view === "home"} onClick={() => setView("home")}><TeamLogo src={payload.teams.home.logo} name={payload.teams.home.name} size={20} /><span>{payload.league === "NFL" ? payload.teams.home.shortName : teamDisplayName("CFB", payload.teams.home.name || payload.teams.home.shortName)}</span></button>
    </div>
    {view === "all" ? <TeamStats payload={payload} /> : <TeamBox payload={payload} side={view} />}
  </div>;
}

export default function GameTracker({ game, onClose, appSlug }: { game: Game; onClose: () => void; appSlug: AppSlug }) {
  const finalAtOpen = Boolean(game.live_completed || (game.final_home_score != null && game.final_away_score != null));
  const [tab, setTab] = useState<TrackerTab>(finalAtOpen ? "scoring" : "live");
  const [payload, setPayload] = useState<TrackerPayload | null>(null);
  const payloadSignature = useRef("");
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const sheet = useRef<HTMLElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const closeWithMotion = useGameSheetDismiss(sheet, mounted, onClose);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    const priorOverflow = document.body.style.overflow;
    const priorFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    // Keep the fixed main navigation usable underneath the detail view.
    let switchedDestination = false;
    const onMainNavigation = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest(".primary-nav button")) {
        switchedDestination = true;
        close.current();
      }
    };
    document.addEventListener("click", onMainNavigation);
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
      document.removeEventListener("click", onMainNavigation);
      if (!switchedDestination) priorFocus?.focus();
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
        const next = await loadTracker(game.id, appSlug);
        if (!active) return;
        const signature = JSON.stringify(next);
        if (payloadSignature.current !== signature) {
          payloadSignature.current = signature;
          setPayload(next);
        }
        setError("");
        if (!next.status.completed) timer = window.setTimeout(refresh, 3000);
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Could not load GameTracker.");
        timer = window.setTimeout(refresh, 5000);
      }
    };
    void refresh();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [game.id, appSlug]);

  useEffect(() => {
    if (payload?.status.completed && tab === "live") setTab("scoring");
  }, [payload?.status.completed, tab]);

  if (!mounted) return null;

  const awayName = teamDisplayName(game.league, game.away_team);
  const homeName = teamDisplayName(game.league, game.home_team);
  const completed = Boolean(game.live_completed || (game.final_home_score != null && game.final_away_score != null) || payload?.status.completed);
  const tabs: Array<[TrackerTab, string]> = [
    ["plays", "Plays"],
    ["scoring", "Scoring"],
    ...(completed ? [] : [["live", "Live"] as [TrackerTab, string]])
  ];
  const matchupHeader = `${awayName}${game.neutral_site ? " vs " : " at "}${homeName}`;

  return createPortal(<div className="game-tracker-backdrop" onClick={(event) => { if (event.target === event.currentTarget) closeWithMotion(); }}>
    <section ref={sheet} className="game-tracker-sheet football-game-tracker" role="dialog" aria-modal="false" aria-label={`${matchupHeader} GameTracker`}>
      <header className="game-tracker-header">
        <div className="game-detail-title">
          
          <strong>{matchupHeader}</strong>
        </div>
        <GameDetailClose onClose={closeWithMotion} label="Close GameTracker" />
      </header>

      <div className="game-tracker-scoreboard football-scoreboard">
        <div className="game-tracker-scoreboard-grid">
          {(["away", "home"] as const).map(side => {
            const team = payload?.teams[side];
            const colors = trackerTeamColors(team?.color, team?.alternateColor);
            return <svg key={side} className={`football-scoreboard-band ${side}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 0H100L81 100H0Z" fill={colors.secondary} />
              <path d="M0 0H87L75 100H0Z" fill={colors.primary} />
            </svg>;
          })}
          <TeamScore side="away" payload={payload} game={game} completed={completed} />
          <ScoreboardCenter payload={payload} game={game} completed={completed} />
          <TeamScore side="home" payload={payload} game={game} completed={completed} />
        </div>
      </div>

      <nav className="game-tracker-tabs tracker-primary-tabs" aria-label="Football game sections">
        <button type="button" className={tab !== "box" ? "active" : ""} aria-current={tab !== "box" ? "page" : undefined} onClick={() => { setTab(completed ? "scoring" : "live"); scrollArea.current?.scrollTo(0, 0); }}>GameTracker</button>
        <button type="button" className={tab === "box" ? "active" : ""} aria-current={tab === "box" ? "page" : undefined} onClick={() => { setTab("box"); scrollArea.current?.scrollTo(0, 0); }}>Box Score</button>
      </nav>

      <div ref={scrollArea} className={`game-tracker-scroll ${tab === "box" ? "box-score" : ""}`.trim()}>
        {tab !== "box" && <nav className="tracker-inner-switch" aria-label="Football GameTracker views">{tabs.map(([id,label]) => <button type="button" key={id} className={tab === id ? "active" : ""} aria-pressed={tab === id} onClick={() => { setTab(id); scrollArea.current?.scrollTo(0, 0); }}>{label}</button>)}</nav>}
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
