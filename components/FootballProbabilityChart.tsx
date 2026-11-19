"use client";

import { useState, type PointerEvent } from "react";
import TeamImage from "@/components/TeamImage";
import { espnFootballCoverPoints, estimatedFootballCoverPoints, smoothFootballCoverSeries, type FootballProbabilityPoint } from "@/lib/footballWinProbability";
import { spreadText } from "@/lib/spreads";
import { trackerPeriodLabel } from "@/lib/trackerPeriods";

type Team = { name: string; shortName: string; logo: string };
type Props = {
  points: FootballProbabilityPoint[];
  away: Team;
  home: Team;
  homeSpread: number | null;
  espnHomeSpread: number | null;
  completed: boolean;
};
function LabelLogo({ team }: { team: Team }) {
  return team.logo ? <TeamImage unoptimized src={team.logo} alt="" width={22} height={22} /> : null;
}
export default function FootballProbabilityCharts({ points, away, home, homeSpread, espnHomeSpread, completed }: Props) {
  const [mode, setMode] = useState<"win" | "cover">("win");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const directCover = espnFootballCoverPoints(points, espnHomeSpread, completed);
  const useEspnCover = mode === "cover" && directCover.length > 1;
  const rawData = mode === "win" ? points
    : useEspnCover ? directCover : estimatedFootballCoverPoints(points, homeSpread, completed);
  const data = mode === "cover" ? smoothFootballCoverSeries(rawData) : rawData;
  const coverLine = useEspnCover ? espnHomeSpread : homeSpread;
  const coverSource = useEspnCover ? "ESPN (smoothed)" : "Estimated (smoothed)";
  const valid = data.filter(point => Number.isFinite(point.home) && point.home >= 0 && point.home <= 1 && Number.isFinite(point.progress));
  const domain = Math.max(1, ...valid.map(point => point.progress));
  const selected = valid.find(point => point.id === selectedId) || valid[valid.length - 1];
  const index = selected ? valid.indexOf(selected) : 0;
  const x = (point: FootballProbabilityPoint) => 35 + point.progress / domain * 278;
  const y = (point: FootballProbabilityPoint) => 130 - point.home * 108;
  const path = valid.map((point, index) => `${index ? "L" : "M"}${x(point).toFixed(2)} ${y(point).toFixed(2)}`).join(" ");
  const first = valid[0], last = valid[valid.length - 1];
  const upper = first && last ? `${path} L${x(last)} 22 L${x(first)} 22 Z` : "";
  const lower = first && last ? `${path} L${x(last)} 130 L${x(first)} 130 Z` : "";
  const selectAtPointer = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const progress = Math.max(0, Math.min(domain, ((event.clientX - bounds.left) / bounds.width * 330 - 35) / 278 * domain));
    const closest = valid.reduce((best, point) => !best || Math.abs(point.progress - progress) < Math.abs(best.progress - progress) ? point : best, null as FootballProbabilityPoint | null);
    if (closest) setSelectedId(closest.id);
  };
  const selectionTime = selected?.clock
    ? `${selected.clock} · ${trackerPeriodLabel(String(selected.period))}`
    : selected ? `Play ${index + 1}` : "—";
  const selectionText = selected ? `${selectionTime} · ${away.shortName} ${selected.awayScore ?? "—"}–${home.shortName} ${selected.homeScore ?? "—"} · ${home.shortName} ${Math.round(selected.home * 100)}%` : "";
  const noData = mode === "win"
    ? "ESPN has not published a usable win-probability series for this game."
    : homeSpread == null ? "A game spread is required to estimate cover probability."
    : "The saved spread is available, but there isn't enough ESPN opening probability and play-score data to estimate a cover chart.";
  return <section className="basketball-score-flow basketball-win-probability football-probability" aria-label={mode === "win" ? "ESPN football win probability" : useEspnCover ? "ESPN football cover probability" : "Estimated football cover probability"}>
    <div className="basketball-probability-heading">
      <h3>Probability</h3>
      <div className="basketball-probability-toggle" role="group" aria-label="Probability type">
        <button type="button" aria-pressed={mode === "win"} onClick={() => { setMode("win"); setSelectedId(null); }}>Win</button>
        <button type="button" aria-pressed={mode === "cover"} onClick={() => { setMode("cover"); setSelectedId(null); }}>Cover</button>
      </div>
    </div>
    {valid.length > 1 && selected ? <div className="basketball-probability-chart">
      <div className="basketball-probability-team-label top"><LabelLogo team={home} /><span>{home.shortName}</span><strong>{selected.push ? "Push" : `${(selected.home * 100).toFixed(1)}%`}</strong></div>
      <output className="basketball-probability-readout" aria-live="polite" aria-label={selectionText}>
        <time>{selectionTime}</time>
        <span><LabelLogo team={away} />{selected.awayScore ?? "—"}<span>–</span>{selected.homeScore ?? "—"}<LabelLogo team={home} /></span>
      </output>
      <svg viewBox="0 0 330 159" role="slider" tabIndex={0} aria-valuemin={0} aria-valuemax={valid.length - 1} aria-valuenow={index} aria-valuetext={selectionText} aria-label={`Inspect football ${mode} probability`}
        onKeyDown={event => {
          const next = event.key === "Home" ? 0 : event.key === "End" ? valid.length - 1
            : event.key === "ArrowLeft" || event.key === "ArrowDown" ? Math.max(0, index - 1)
            : event.key === "ArrowRight" || event.key === "ArrowUp" ? Math.min(valid.length - 1, index + 1) : null;
          if (next != null) { event.preventDefault(); setSelectedId(valid[next].id); }
        }}
        onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); selectAtPointer(event); }}
        onPointerMove={event => { if (event.buttons || event.pointerType === "mouse") selectAtPointer(event); }}>
        <path d={upper} className="basketball-probability-upper" />
        <path d={lower} className="basketball-probability-lower" />
        <line x1="35" x2="313" y1="76" y2="76" className="basketball-flow-grid" />
        <path d={path} className="basketball-probability-curve" />
        <text x="30" y="25" textAnchor="end" className="basketball-flow-axis">100%</text>
        <text x="30" y="79" textAnchor="end" className="basketball-flow-axis">50%</text>
        <text x="30" y="133" textAnchor="end" className="basketball-flow-axis">0%</text>
        <line x1={x(selected)} x2={x(selected)} y1="22" y2="130" className="basketball-probability-cursor" />
        <circle cx={x(selected)} cy={y(selected)} r="3.5" className="basketball-probability-marker" />
        <text x="35" y="151" textAnchor="start" className="basketball-flow-axis">Start</text>
        <text x="313" y="151" textAnchor="end" className="basketball-flow-axis">{domain > 1 ? "OT" : "End"}</text>
      </svg>
      <div className="basketball-probability-team-label bottom"><LabelLogo team={away} /><span>{away.shortName}</span><strong>{selected.push ? "Push" : `${((1 - selected.home) * 100).toFixed(1)}%`}</strong></div>
      <small className="basketball-probability-hint">Drag to inspect the game by play.</small>
      {mode === "cover" && <small className="basketball-cover-estimate-note">{coverSource} · {home.shortName} {coverLine != null ? spreadText(coverLine) : "ESPN line"} · {useEspnCover
        ? "ESPN's game-by-game cover probability. Based on ESPN's spread, which may differ from the saved DraftKings line."
        : "Estimated from the saved game spread, ESPN win probabilities and remaining time. Not sportsbook odds."}</small>}
    </div> : <p className="football-probability-empty">{noData}</p>}
  </section>;
}
