"use client";

import { basketballPeriodLabel, shotBaselineDistance, type BasketballShot } from "@/lib/basketballShots";
import { playTextWithoutDuplicateClock } from "@/lib/playText";
import Image from "next/image";

type Side = "away" | "home";
type Action = { id: string; text: string; side: Side | null; period: number; clock: string };
type Play = { id: string; text: string; period: number; clock: string; progress?: number | null; side?: Side | null; awayScore: number | null; homeScore: number | null };
type ProbabilityPoint = { id: string; home: number; progress: number };
function StableTeamLogo({ src, name, size = 22 }: { src?: string | null; name: string; size?: number }) {
  return src ? <Image unoptimized src={src} width={size} height={size} alt={name} /> : <span aria-hidden="true" className="basketball-logo-placeholder" />;
}

export default function BasketballLiveCourt({ shots, plays, possessionSide, latestAction, away, home, awayId, homeId, college, awayLogo, homeLogo, winProbability }: {
  shots: BasketballShot[];
  plays: Play[];
  possessionSide: Side | null;
  latestAction: Action | null;
  away: string;
  home: string;
  awayId: string;
  homeId: string;
  college: boolean;
  awayLogo?: string | null;
  homeLogo?: string | null;
  winProbability?: ProbabilityPoint[];
}) {
  const names = { away, home };
  const logos = { away: awayLogo, home: homeLogo };
  const logoFor = (side: Side | null, size = 22) => side ? <StableTeamLogo src={logos[side]} name={names[side]} size={size} /> : null;
  const periodText = (period: number) => basketballPeriodLabel(period, college);
  const playTeam = (play: Play) => play.side || null;
  // Only highlight the current play's shot; don't keep showing an older shot
  // while the ball is elsewhere on the court.
  const latest = shots.find(shot => shot.id === latestAction?.id && (shot.teamId === awayId || shot.teamId === homeId));
  // The ESPN source uses a 50x94-foot court. Mirror a shot from the far
  // half to its attacking basket without fabricating a missing location.
  const shotX = latest ? latest.x : null;
  const shotY = latest ? Math.max(0, Math.min(47, shotBaselineDistance(latest.y > 47 ? 94 - latest.y : latest.y))) : null;
  const recentPlays = [...plays].reverse().filter((play) =>
    play.id !== latestAction?.id && play.text && !/^(start|end) of (the )?(period|quarter|half)/i.test(play.text)
  ).slice(0, 5);

  return <section className="basketball-live-view" aria-label="Live basketball court and game flow">
    <div className="basketball-live-action" aria-live="polite">
      {logoFor(latestAction?.side || null, 27)}
      <div><span>{latestAction ? `${latestAction.clock} · ${periodText(latestAction.period)}` : "Waiting for play"}</span>
      <strong>{latestAction ? playTextWithoutDuplicateClock(latestAction.text, latestAction.clock) : "Waiting for the next play…"}</strong></div>
    </div>
    <div className="basketball-simple-court-wrap">
      <svg className="basketball-simple-court" viewBox="-1 -1 52 49" role="img" aria-label={latest ? `Last shot: ${latest.player}, ${latest.made ? "made" : "missed"} for ${latest.teamId === awayId ? away : home} at ESPN court coordinates ${latest.x}, ${latest.y}` : "Half basketball court. Last shot coordinates unavailable."}>
        <rect x="0" y="0" width="50" height="47" className="basketball-court-floor" />
        <g className="basketball-simple-lines">
          <rect x="0" y="0" width="50" height="47" />
          <path d="M17 0V19H33V0 M22 4H28 M21 5.25A4 4 0 0 0 29 5.25" />
          <circle cx="25" cy="5.25" r=".75" />
          <path d="M19 19 A6 6 0 0 0 31 19" />
          <path d={(() => {
            const radius = college ? 22.1458 : 23.75;
            const corner = college ? 3.3333 : 3;
            const arcY = 5.25 + Math.sqrt(radius ** 2 - (25 - corner) ** 2);
            const arc = Array.from({ length: 49 }, (_, i) => {
              const x = corner + (50 - 2 * corner) * i / 48;
              const y = 5.25 + Math.sqrt(Math.max(0, radius ** 2 - (x - 25) ** 2));
              return `${i ? "L" : "M"}${x.toFixed(3)} ${y.toFixed(3)}`;
            }).join(" ");
            return `M${corner} 0V${arcY} ${arc} V0`;
          })()} />
          <path d="M0 47H50" /><path d="M19 47A6 6 0 0 1 31 47" />
        </g>
        {latest && shotX != null && shotY != null && <g className={`basketball-latest-shot ${latest.made ? "made" : "missed"}`} transform={`translate(${shotX} ${shotY})`}>
          {latest.made
            ? <circle r=".65" />
            : <path d="M-.75 -.75L.75 .75 M-.75 .75L.75 -.75" />}
        </g>}
      </svg>
    </div>
    <div className="basketball-last-plays">
      <h3>Last 5 plays</h3>
      {recentPlays.length ? recentPlays.map((play, index) => {
        const previous = [...plays].reverse().find((row) => row.id !== play.id && plays.indexOf(row) < plays.indexOf(play));
        const changed = play.awayScore != null && play.homeScore != null && (previous == null || previous.awayScore !== play.awayScore || previous.homeScore !== play.homeScore);
        return <div className="basketball-last-play" key={play.id}>
          {logoFor(playTeam(play), 23)}
          <div><time>{play.clock} · {periodText(play.period)}</time><span>{playTextWithoutDuplicateClock(play.text, play.clock)}</span></div>
          {changed && <div className="basketball-recent-score"><span>{play.awayScore}</span><span>{play.homeScore}</span></div>}
        </div>;
      }) : <p className="muted">No earlier plays yet.</p>}
    </div>
    <BasketballWinProbability points={winProbability || []} away={away} home={home} awayLogo={awayLogo} homeLogo={homeLogo} />
  </section>;
}

export function BasketballWinProbability({ points, away, home, awayLogo, homeLogo }: { points: ProbabilityPoint[]; away: string; home: string; awayLogo?: string | null; homeLogo?: string | null }) {
  const valid = points.filter(point => Number.isFinite(point.home) && Number.isFinite(point.progress) && point.progress >= 0);
  const path = valid.map((point, i) => `${i ? "L" : "M"}${(28 + Math.min(1, point.progress) * 286).toFixed(2)} ${(128 - point.home * 106).toFixed(2)}`).join(" ");
  return <section className="basketball-score-flow basketball-win-probability" aria-label="ESPN win probability">
    <h3>Win Probability</h3>
    {valid.length > 1 ? <>
      <svg viewBox="0 0 330 159" role="img" aria-label={`ESPN home team win probability over elapsed game time for ${home}`}>
        {[0, .25, .5, .75, 1].map(value => <g key={value}><line x1="28" x2="314" y1={128 - 106 * value} y2={128 - 106 * value} className="basketball-flow-grid" /><text x="23" y={131 - 106 * value} textAnchor="end" className="basketball-flow-axis">{Math.round(value * 100)}%</text></g>)}
        <path d={path} className="basketball-flow-away" />
        <text x="28" y="150" textAnchor="start" className="basketball-flow-axis">Start</text>
        <text x="314" y="150" textAnchor="end" className="basketball-flow-axis">End</text>
      </svg>
      <div className="basketball-flow-legend"><span><StableTeamLogo src={awayLogo} name={away} size={22} />{away}</span><span><StableTeamLogo src={homeLogo} name={home} size={22} />{home}: {Math.round(valid[valid.length - 1].home * 100)}%</span></div>
    </> : <p className="game-tracker-empty">ESPN win probability isn't available for this game yet.</p>}
  </section>;
}

export function BasketballScoreFlow({ plays, away, home, awayLogo, homeLogo, college = true }: { plays: Play[]; away: string; home: string; awayLogo?: string | null; homeLogo?: string | null; college?: boolean }) {
  // ESPN supplies the scores on each play. Plot their actual cumulative
  // progression, not an invented scoring model or margin-only approximation.
  const points = plays
    .filter(play => play.awayScore != null && play.homeScore != null)
    .map(play => ({ away: Number(play.awayScore), home: Number(play.homeScore), period: play.period, progress: play.progress }))
    .filter(play => Number.isFinite(play.away) && Number.isFinite(play.home));
  const distinct = [{ away: 0, home: 0, period: 1, progress: 0 }, ...points.filter((play, index) =>
    index === 0 || play.away !== points[index - 1].away || play.home !== points[index - 1].home
  )];
  const sampled = distinct.length > 135
    ? distinct.filter((_, index) => index === 0 || index % Math.ceil(distinct.length / 135) === 0 || index === distinct.length - 1)
    : distinct;
  const maxScore = Math.max(10, ...sampled.flatMap(point => [point.away, point.home]));
  const ceiling = Math.ceil(maxScore / 10) * 10;
  const periodCount = college ? 2 : 4;
  const chartX = (progress: number) => 36 + Math.max(0, Math.min(1, progress)) * 276;
  const chartY = (value: number) => 136 - value / ceiling * 116;
  const pathFor = (side: Side) => sampled.map((point, index) => {
    const progress = point.progress;
    // A missing clock is never assigned a fabricated timestamp.
    if (progress == null || !Number.isFinite(progress)) return "";
    return `${index === 0 ? "M" : "L"}${chartX(progress).toFixed(2)} ${chartY(point[side]).toFixed(2)}`;
  }).filter(Boolean).join(" ");
  const boundaries = Array.from({ length: periodCount - 1 }, (_, idx) => chartX((idx + 1) / periodCount));
  return <section className="basketball-score-flow" aria-label="Game flow">
    <h3>Game Flow</h3>
    {sampled.length > 1 ? <>
      <svg viewBox="0 0 330 164" role="img" aria-label={`Cumulative points throughout the game. ${away} solid line, ${home} dashed line.`}>
        {[0, 1, 2, 3, 4].map(tick => {
          const value = Math.round(ceiling * tick / 4);
          const y = chartY(value);
          return <g key={tick}><line x1="36" y1={y} x2="312" y2={y} className="basketball-flow-grid" /><text x="28" y={y + 3} textAnchor="end" className="basketball-flow-axis">{value}</text></g>;
        })}
        {boundaries.map((x, index) => <line key={index} x1={x} y1="20" x2={x} y2="136" className="basketball-flow-boundary" />)}
        <path d={pathFor("away")} className="basketball-flow-away" />
        <path d={pathFor("home")} className="basketball-flow-home" />
        {Array.from({ length: periodCount }, (_, idx) => <text key={idx} x={36 + (idx + .5) * 276 / periodCount} y="154" textAnchor="middle" className="basketball-flow-axis">{college ? (idx === 0 ? "1st" : "2nd") : `Q${idx + 1}`}</text>)}
      </svg>
      <div className="basketball-flow-legend"><span><StableTeamLogo src={awayLogo} name={away} size={19} /><i className="basketball-flow-legend-line away" />{away}</span><span><StableTeamLogo src={homeLogo} name={home} size={19} /><i className="basketball-flow-legend-line home" />{home}</span></div>
    </> : <p className="muted">Game flow appears as scoring data becomes available.</p>}
  </section>;
}
