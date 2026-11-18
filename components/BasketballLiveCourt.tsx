"use client";

import { basketballPeriodLabel, shotBaselineDistance, type BasketballShot } from "@/lib/basketballShots";
import { playTextWithoutDuplicateClock } from "@/lib/playText";
import Image from "@/components/TeamImage";
import { basketballScoreFlow } from "@/lib/basketballGameFlow";
import { spreadText } from "@/lib/spreads";
import { useId, useState, type PointerEvent } from "react";
import { estimatedCoverPoints, nearestProbabilityPoint, type BasketballProbabilityPoint } from "@/lib/basketballWinProbability";

type Side = "away" | "home";
type Action = { id: string; text: string; side: Side | null; period: number; clock: string };
type Play = { id: string; text: string; period: number; clock: string; progress?: number | null; side?: Side | null; awayScore: number | null; homeScore: number | null };
type ProbabilityPoint = BasketballProbabilityPoint;
function StableTeamLogo({ src, name, size = 22 }: { src?: string | null; name: string; size?: number }) {
  return src ? <Image unoptimized src={src} width={size} height={size} alt={name} /> : <span aria-hidden="true" className="basketball-logo-placeholder" />;
}

export default function BasketballLiveCourt({ shots, plays, possessionSide, latestAction, away, home, awayId, homeId, college, awayLogo, homeLogo, winProbability, homeSpread = null, completed = false }: {
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
  homeSpread?: number | null;
  completed?: boolean;
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
  const courtLength = Math.min(47, Math.max(35, (shotY ?? 0) + 2));
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
      <svg className="basketball-simple-court" viewBox={`-1 -1 52 ${courtLength + 2}`} role="img" aria-label={latest ? `Last shot: ${latest.player}, ${latest.made ? "made" : "missed"} for ${latest.teamId === awayId ? away : home} at ESPN court coordinates ${latest.x}, ${latest.y}` : "Half basketball court. Last shot coordinates unavailable."}>
        <rect x="0" y="0" width="50" height={courtLength} className="basketball-court-floor" />
        <g className="basketball-simple-lines">
          <rect x="0" y="0" width="50" height={courtLength} />
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
          <path d={`M0 ${courtLength}H50`} />
        </g>
        {latest && shotX != null && shotY != null && <g className={`basketball-latest-shot ${latest.made ? "made" : "missed"}`} transform={`translate(${shotX} ${shotY})`}>
          {latest.made
            ? <circle r=".65" />
            : <path d="M-.75 -.75L.75 .75 M-.75 .75L.75 -.75" />}
        </g>}
      </svg>
    </div>
    <div className="basketball-last-plays">
      <div className="basketball-recent-plays-heading"><h3>Last 5 plays</h3><div className="basketball-period-scores"><StableTeamLogo src={awayLogo} name={away} size={22} /><StableTeamLogo src={homeLogo} name={home} size={22} /></div></div>
      {recentPlays.length ? recentPlays.map((play) => {
        return <div className="basketball-last-play" key={play.id}>
          <span className="basketball-recent-play-logo">{logoFor(playTeam(play), 23)}</span>
          <p className="basketball-recent-play-copy"><time>{play.clock},</time> {playTextWithoutDuplicateClock(play.text, play.clock)}</p>
          <div className="basketball-recent-score" aria-label={`${away} ${play.awayScore ?? "—"}, ${home} ${play.homeScore ?? "—"}`}>
            <span>{play.awayScore ?? "—"}</span><span>{play.homeScore ?? "—"}</span>
          </div>
        </div>;
      }) : <p className="muted">No earlier plays yet.</p>}
    </div>
    <BasketballWinProbability points={winProbability || []} away={away} home={home} awayLogo={awayLogo} homeLogo={homeLogo} college={college} homeSpread={homeSpread} completed={completed} />
  </section>;
}

export function BasketballWinProbability({ points, away, home, awayLogo, homeLogo, college = true, homeSpread = null, completed = false }: { points: ProbabilityPoint[]; away: string; home: string; awayLogo?: string | null; homeLogo?: string | null; college?: boolean; homeSpread?: number | null; completed?: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"win" | "cover">("win");
  const source = mode === "cover" ? estimatedCoverPoints(points, homeSpread, college, completed) : points;
  const valid = source.filter(point => Number.isFinite(point.home) && point.home >= 0 && point.home <= 1 && Number.isFinite(point.progress) && point.progress >= 0);
  const domain = Math.max(1, ...valid.map(point => point.progress));
  const chartX = (point: ProbabilityPoint) => 35 + point.progress / domain * 278;
  const chartY = (point: ProbabilityPoint) => 130 - point.home * 108;
  const selected = valid.find(point => point.id === selectedId) || valid[valid.length - 1];
  const selectedIndex = selected ? valid.indexOf(selected) : 0;
  const path = valid.map((point, i) => `${i ? "L" : "M"}${chartX(point).toFixed(2)} ${chartY(point).toFixed(2)}`).join(" ");
  const lastX = valid.length ? chartX(valid[valid.length - 1]) : 35;
  const firstX = valid.length ? chartX(valid[0]) : 35;
  const upperArea = `${path} L${lastX.toFixed(2)} 22 L${firstX.toFixed(2)} 22 Z`;
  const lowerArea = `${path} L${lastX.toFixed(2)} 130 L${firstX.toFixed(2)} 130 Z`;
  const inspect = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width * 330;
    const point = nearestProbabilityPoint(valid, Math.max(0, Math.min(1, (x - 35) / 278)) * domain);
    if (point) setSelectedId(point.id);
  };
  const selectionText = selected ? `${selected.clock || "Time unavailable"}${selected.period ? ` · ${basketballPeriodLabel(selected.period, college)}` : ""}, ${away} ${selected.awayScore ?? "—"}, ${home} ${selected.homeScore ?? "—"}, ${home} ${(selected.home * 100).toFixed(1)}%, ${away} ${((1 - selected.home) * 100).toFixed(1)}%` : "";
  return <section className="basketball-score-flow basketball-win-probability" aria-label={mode === "win" ? "ESPN win probability" : "Estimated cover probability"}>
    <div className="basketball-probability-heading"><h3>Probability</h3><div className="basketball-probability-toggle" role="group" aria-label="Probability type"><button type="button" aria-pressed={mode === "win"} onClick={() => setMode("win")}>Win</button><button type="button" aria-pressed={mode === "cover"} onClick={() => setMode("cover")}>Cover</button></div></div>
    {valid.length > 1 ? <div className="basketball-probability-chart">
      <div className="basketball-probability-team-label top"><StableTeamLogo src={homeLogo} name={home} size={24} /><span>{home}</span><strong>{selected.push ? "Push" : `${(selected.home * 100).toFixed(1)}%`}</strong></div>
      <output className="basketball-probability-readout" aria-live="polite" aria-label={selectionText}>
        <time>{selected.clock || "—"}{selected.period ? ` · ${basketballPeriodLabel(selected.period, college)}` : ""}</time>
        <span><StableTeamLogo src={awayLogo} name={away} size={18} />{selected.awayScore ?? "—"}<span>–</span>{selected.homeScore ?? "—"}<StableTeamLogo src={homeLogo} name={home} size={18} /></span>
      </output>
      <svg viewBox="0 0 330 159" role="slider" tabIndex={0} aria-valuemin={0} aria-valuemax={valid.length - 1} aria-valuenow={selectedIndex} aria-valuetext={selectionText} aria-label={`Inspect ${mode} probability by play`} onKeyDown={event => {
        const next = event.key === "Home" ? 0 : event.key === "End" ? valid.length - 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? Math.max(0, selectedIndex - 1) : event.key === "ArrowRight" || event.key === "ArrowUp" ? Math.min(valid.length - 1, selectedIndex + 1) : null;
        if (next != null) { event.preventDefault(); setSelectedId(valid[next].id); }
      }} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); inspect(event); }} onPointerMove={event => { if (event.buttons || event.pointerType === "mouse") inspect(event); }}>
        <path d={upperArea} className="basketball-probability-upper" />
        <path d={lowerArea} className="basketball-probability-lower" />
        <line x1="35" x2="313" y1="76" y2="76" className="basketball-flow-grid" />
        <path d={path} className="basketball-probability-curve" />
        <text x="30" y="25" textAnchor="end" className="basketball-flow-axis">100%</text>
        <text x="30" y="79" textAnchor="end" className="basketball-flow-axis">50%</text>
        <text x="30" y="133" textAnchor="end" className="basketball-flow-axis">0%</text>
        <line x1={chartX(selected)} x2={chartX(selected)} y1="22" y2="130" className="basketball-probability-cursor" />
        <circle cx={chartX(selected)} cy={chartY(selected)} r="3.5" className="basketball-probability-marker" />
        <text x="35" y="151" textAnchor="start" className="basketball-flow-axis">Start</text>
        <text x="313" y="151" textAnchor="end" className="basketball-flow-axis">{domain > 1 ? "OT" : "End"}</text>
      </svg>
      <div className="basketball-probability-team-label bottom"><StableTeamLogo src={awayLogo} name={away} size={24} /><span>{away}</span><strong>{selected.push ? "Push" : `${((1 - selected.home) * 100).toFixed(1)}%`}</strong></div>
      <small className="basketball-probability-hint">Drag the chart to see time, score and probability.</small>
      {mode === "cover" && <small className="basketball-cover-estimate-note">Estimate · {home} {spreadText(homeSpread)} / {away} {spreadText(homeSpread == null ? null : -homeSpread)}<br />Uses the pregame spread, opening win probability, score and time.</small>}
    </div> : <p className="game-tracker-empty">{mode === "cover" ? "Cover estimate needs a pregame spread and an opening win probability consistent with that spread." : "ESPN win probability is not available for this game yet."}</p>}
  </section>;
}

export function BasketballScoreFlow({ plays, away, home, awayLogo, homeLogo, college, final }: {
  plays: Play[]; away: string; home: string; awayLogo?: string | null; homeLogo?: string | null;
  college: boolean; final?: { away: number | null; home: number | null; period: number };
}) {
  const revealId = `flow-reveal-${useId().replace(/:/g, "")}`;
  const { points, ticks, ceiling, domain } = basketballScoreFlow(plays, final && { ...final, college });
  const periodCount = college ? 2 : 4;
  const chartX = (progress: number) => 36 + progress / domain * 276;
  const chartY = (value: number) => 136 - value / ceiling * 116;
  const pathFor = (side: Side) => points.map((point, index) =>
    `${index === 0 ? "M" : "L"}${chartX(point.progress).toFixed(2)} ${chartY(point[side]).toFixed(2)}`).join(" ");
  const boundaries = Array.from({ length: periodCount - 1 }, (_, index) => (index + 1) / periodCount);
  if (domain > 1) boundaries.push(1);
  return <section className="basketball-score-flow" aria-label="Game flow">
    <h3>Game Flow</h3>
    {points.length > 1 ? <>
      <svg viewBox="0 0 330 164" role="img" aria-label={`Cumulative points throughout the game. ${away} solid line, ${home} dashed line.`}>
        {ticks.map(value => {
          const y = chartY(value);
          return <g key={value}><line x1="36" y1={y} x2="312" y2={y} className="basketball-flow-grid" /><text x="28" y={y + 3} textAnchor="end" className="basketball-flow-axis">{value}</text></g>;
        })}
        {boundaries.map(progress => <line key={progress} x1={chartX(progress)} y1="20" x2={chartX(progress)} y2="136" className="basketball-flow-boundary" />)}
        <defs><clipPath id={revealId}><rect x="36" y="0" width="276" height="164" className="basketball-flow-reveal" /></clipPath></defs>
        <g clipPath={`url(#${revealId})`}><path d={pathFor("away")} className="basketball-flow-away" />
        <path d={pathFor("home")} className="basketball-flow-home" /></g>
        {Array.from({ length: periodCount }, (_, index) => <text key={index} x={chartX((index + .5) / periodCount)} y="154" textAnchor="middle" className="basketball-flow-axis">{college ? (index === 0 ? "1st" : "2nd") : basketballPeriodLabel(index + 1, college)}</text>)}
        {domain > 1 && <text x={chartX((1 + domain) / 2)} y="154" textAnchor="middle" className="basketball-flow-axis">OT</text>}
      </svg>
      <div className="basketball-flow-legend"><span aria-label={`${away}, solid line`}><StableTeamLogo src={awayLogo} name={away} size={19} /><i className="basketball-flow-legend-line away" /></span><span aria-label={`${home}, dashed line`}><StableTeamLogo src={homeLogo} name={home} size={19} /><i className="basketball-flow-legend-line home" /></span></div>
    </> : <p className="muted">Game flow appears as scoring data becomes available.</p>}
  </section>;
}
