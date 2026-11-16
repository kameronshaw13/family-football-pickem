"use client";

import { basketballPeriodLabel, type BasketballShot } from "@/lib/basketballShots";
import { playTextWithoutDuplicateClock } from "@/lib/playText";
import Image from "next/image";

type Side = "away" | "home";
type Action = { id: string; text: string; side: Side | null; period: number; clock: string };
type Play = { id: string; text: string; period: number; clock: string; side?: Side | null; awayScore: number | null; homeScore: number | null };

export default function BasketballLiveCourt({ shots, plays, possessionSide, latestAction, away, home, awayId, homeId, college, awayLogo, homeLogo }: {
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
}) {
  const names = { away, home };
  const logos = { away: awayLogo, home: homeLogo };
  const Logo = ({ side, size = 22 }: { side: Side | null; size?: number }) => side && logos[side] ? <Image unoptimized src={logos[side]!} width={size} height={size} alt={names[side]} /> : null;
  const periodText = (period: number) => basketballPeriodLabel(period, college);
  const playTeam = (play: Play) => play.side || null;
  const latest = [...shots].reverse().find((shot) => shot.teamId === awayId || shot.teamId === homeId);
  // The ESPN source uses a 50x94-foot court. Mirror a shot from the far
  // half to its attacking basket without fabricating a missing location.
  const shotX = latest ? (latest.y > 47 ? 50 - latest.x : latest.x) : null;
  const shotY = latest ? (latest.y > 47 ? 94 - latest.y : latest.y) : null;
  const recentPlays = [...plays].reverse().filter((play) =>
    play.id !== latestAction?.id && play.text && !/^(start|end) of (the )?(period|quarter|half)/i.test(play.text)
  ).slice(0, 5);
  // Grounded score flow: each point comes from an actual ESPN play score.
  const scoring = plays.filter((play) => play.awayScore != null && play.homeScore != null);
  const sampled = scoring.length > 80 ? scoring.filter((_, index) => index % Math.ceil(scoring.length / 80) === 0 || index === scoring.length - 1) : scoring;
  const diffs = sampled.map((play) => Number(play.awayScore) - Number(play.homeScore));
  const maxMargin = Math.max(5, ...diffs.map((margin) => Math.abs(margin)));
  const path = diffs.map((margin, index) => `${index === 0 ? "M" : "L"} ${12 + index * (296 / Math.max(1, diffs.length - 1))} ${51 - margin / maxMargin * 37}`).join(" ");

  return <section className="basketball-live-view" aria-label="Live basketball court and game flow">
    <div className="basketball-live-action" aria-live="polite">
      <Logo side={latestAction?.side || null} size={27} />
      <div><span>{latestAction ? `${latestAction.clock} · ${periodText(latestAction.period)}` : "Waiting for play"}</span>
      <strong>{latestAction ? playTextWithoutDuplicateClock(latestAction.text, latestAction.clock) : "Waiting for the next play…"}</strong></div>
    </div>
    <div className="basketball-simple-court-wrap">
      <div className="basketball-court-with-possession"><div className="basketball-court-side-possession" aria-label={possessionSide ? `${names[possessionSide]} has possession` : "Possession unavailable"}><Logo side={possessionSide} size={26} />{possessionSide && <span aria-hidden="true">🏀</span>}</div>
      <svg className="basketball-simple-court" viewBox="-1 -1 52 49" role="img" aria-label={latest ? `Last shot: ${latest.player}, ${latest.made ? "made" : "missed"} for ${latest.teamId === awayId ? away : home} at ESPN court coordinates ${latest.x}, ${latest.y}` : "Half basketball court. Last shot coordinates unavailable."}>
        <rect x="0" y="0" width="50" height="47" className="basketball-court-floor" />
        <g className="basketball-simple-lines">
          <rect x="0" y="0" width="50" height="47" />
          <path d="M17 0V19H33V0 M22 4H28 M21 5.25A4 4 0 0 0 29 5.25" />
          <circle cx="25" cy="5.25" r=".75" />
          <path d="M19 19 A6 6 0 0 0 31 19" />
          <path d={college
            ? "M3.333 0V5.38 A22.1458 22.1458 0 0 0 46.667 5.38 V0"
            : "M3 0V6.55 A23.75 23.75 0 0 0 47 6.55 V0"} />
          <path d="M0 47H50" /><path d="M19 47A6 6 0 0 1 31 47" />
        </g>
        {latest && shotX != null && shotY != null && <g className={`basketball-latest-shot ${latest.made ? "made" : "missed"}`} transform={`translate(${shotX} ${shotY})`}>
          {latest.made
            ? <circle r=".65" />
            : <path d="M-.75 -.75L.75 .75 M-.75 .75L.75 -.75" />}
        </g>}
      </svg></div>
      <div className="basketball-last-shot">
        {latest
          ? <><span className={latest.made ? "made" : "missed"}>{latest.made ? "●" : "×"}</span><strong>{latest.player}</strong><span>{latest.made ? "Made" : "Missed"} · {latest.clock} · {latest.teamId === awayId ? away : home}</span></>
          : <span>No shot coordinates available yet</span>}
      </div>
    </div>
    <div className="basketball-last-plays">
      <h3>Last 5 plays</h3>
      {recentPlays.length ? recentPlays.map((play, index) => {
        const previous = [...plays].reverse().find((row) => row.id !== play.id && plays.indexOf(row) < plays.indexOf(play));
        const changed = play.awayScore != null && play.homeScore != null && (previous == null || previous.awayScore !== play.awayScore || previous.homeScore !== play.homeScore);
        return <div className="basketball-last-play" key={play.id}>
          <Logo side={playTeam(play)} size={23} />
          <div><time>{play.clock} · {periodText(play.period)}</time><span>{playTextWithoutDuplicateClock(play.text, play.clock)}</span></div>
          {changed && <div className="basketball-recent-score"><span><Logo side="away" size={16} />{play.awayScore}</span><span><Logo side="home" size={16} />{play.homeScore}</span></div>}
        </div>;
      }) : <p className="muted">No earlier plays yet.</p>}
    </div>
    <BasketballScoreFlow plays={plays} away={away} home={home} awayLogo={awayLogo} homeLogo={homeLogo} college={college} />
  </section>;
}

export function BasketballScoreFlow({ plays, away, home, awayLogo, homeLogo, college = true }: { plays: Play[]; away: string; home: string; awayLogo?: string | null; homeLogo?: string | null; college?: boolean }) {
  // ESPN supplies the scores on each play. Plot their actual cumulative
  // progression, not an invented scoring model or margin-only approximation.
  const points = plays
    .filter(play => play.awayScore != null && play.homeScore != null)
    .map(play => ({ away: Number(play.awayScore), home: Number(play.homeScore), period: play.period }))
    .filter(play => Number.isFinite(play.away) && Number.isFinite(play.home));
  const distinct = [{ away: 0, home: 0, period: 1 }, ...points.filter((play, index) =>
    index === 0 || play.away !== points[index - 1].away || play.home !== points[index - 1].home
  )];
  const sampled = distinct.length > 135
    ? distinct.filter((_, index) => index === 0 || index % Math.ceil(distinct.length / 135) === 0 || index === distinct.length - 1)
    : distinct;
  const maxScore = Math.max(10, ...sampled.flatMap(point => [point.away, point.home]));
  const ceiling = Math.ceil(maxScore / 10) * 10;
  const chartX = (i: number) => 36 + i * (276 / Math.max(1, sampled.length - 1));
  const chartY = (value: number) => 136 - value / ceiling * 116;
  const pathFor = (side: Side) => sampled.map((point, index) => `${index === 0 ? "M" : "L"}${chartX(index).toFixed(2)} ${chartY(point[side]).toFixed(2)}`).join(" ");
  const periodCount = college ? 2 : 4;
  const boundaries = Array.from({ length: periodCount - 1 }, (_, idx) => {
    const next = sampled.findIndex(p => p.period > idx + 1);
    return next > 0 ? chartX(next) : 36 + (idx + 1) * 276 / periodCount;
  });
  const Logo = ({ side }: { side: Side }) => (side === "away" ? awayLogo : homeLogo)
    ? <Image unoptimized src={(side === "away" ? awayLogo : homeLogo)!} width={19} height={19} alt="" /> : null;
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
      <div className="basketball-flow-legend"><span><Logo side="away" /><i className="basketball-flow-legend-line away" />{away}</span><span><Logo side="home" /><i className="basketball-flow-legend-line home" />{home}</span></div>
    </> : <p className="muted">Game flow appears as scoring data becomes available.</p>}
  </section>;
}
