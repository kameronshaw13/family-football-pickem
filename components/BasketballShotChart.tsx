"use client";

import { useState } from "react";
import Image from "next/image";
import { basketballPeriodLabel, type BasketballShot } from "@/lib/basketballShots";

type Team = { id: string; name: string; logo?: string | null };
export default function BasketballShotChart({ shots, attempts, college, period, away, home, neutralSite = false }: {
  shots: BasketballShot[]; attempts: number; college: boolean; period: number; away: Team; home: Team; neutralSite?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const visible = shots.filter(shot => shot.teamId === away.id || shot.teamId === home.id);
  const selected = visible.find(shot => shot.id === selectedId);
  const courtPosition = (shot: BasketballShot) => {
    const basketDistance = Math.min(shot.y, 94 - shot.y);
    const courtY = shot.teamId === away.id ? 94 - basketDistance : basketDistance;
    return `translate(${shot.x} ${courtY})`;
  };
  const radius = college ? 22.1458 : 23.75;
  const corner = college ? 3.3333 : 3;
  const arcY = 5.25 + Math.sqrt(radius ** 2 - (25 - corner) ** 2);
  // Half court by default; extend the actual court for long heaves rather than relocating a shot.
  const courtLength = 94;
  return <section className="basketball-shot-chart" aria-label="Shot chart">
    <h3 className="basketball-shot-chart-heading">Shot Chart</h3>
    <div className="basketball-shot-court-wrap">
    <svg className="basketball-court" viewBox="-1 -1 96 52" aria-label="Basketball court: away team's shots on the left, home team's shots on the right">
      <g transform="translate(94 0) rotate(90)">
      <g className="basketball-court-lines" fill="none" strokeWidth=".18">
        <rect x="0" y="0" width="50" height={courtLength} />
        <path d="M17 0V19H33V0 M22 4H28 M25 4V4.5" />
        <circle cx="25" cy="5.25" r=".75" />
        <circle cx="25" cy="19" r="6" />
        <path d={`M${corner} 0V${arcY} A${radius} ${radius} 0 0 0 ${50 - corner} ${arcY} V0`} />
        <path d="M21 5.25A4 4 0 0 0 29 5.25" />
        <path d="M0 47H50" /><circle cx="25" cy="47" r="6" />
        {courtLength === 94 && <g transform="translate(50 94) rotate(180)"><path d="M17 0V19H33V0 M22 4H28 M25 4V4.5" /><circle cx="25" cy="5.25" r=".75" /><circle cx="25" cy="19" r="6" /><path d={`M${corner} 0V${arcY} A${radius} ${radius} 0 0 0 ${50 - corner} ${arcY} V0`} /></g>}
      </g>
      {visible.map(shot => <g key={shot.id} className={`basketball-shot ${shot.teamId === away.id ? "away-shot" : "home-shot"} ${shot.made ? "made" : "missed"} ${shot.id === selectedId ? "selected" : ""}`} transform={courtPosition(shot)} role="button" tabIndex={0}
        aria-label={`${shot.player}: ${shot.made ? "made" : "missed"}, ${basketballPeriodLabel(shot.period, college)}, ${shot.clock}`}
        aria-pressed={shot.id === selectedId} onClick={() => setSelectedId(shot.id)} onKeyDown={event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); setSelectedId(shot.id); } }}>
        <title>{shot.text}</title><circle r="1.5" fill="transparent" stroke="none" />
        <circle r=".65" strokeWidth=".19" />
      </g>)}
      </g>
    </svg>
    {!neutralSite && home.logo && <Image unoptimized className="basketball-center-court-logo" src={home.logo} alt="" width={48} height={48} />}
    </div>
    <div className="basketball-shot-key two-team-shot-key">
      <span className="shot-legend-team away">{away.logo && <Image unoptimized src={away.logo} alt="" width={22} height={22} />}<span className="shot-legend-circle made">●</span><span>Made</span><span className="shot-legend-circle missed">○</span><span>Missed</span></span>
      <span className="shot-legend-team home">{home.logo && <Image unoptimized src={home.logo} alt="" width={22} height={22} />}<span className="shot-legend-circle made">●</span><span>Made</span><span className="shot-legend-circle missed">○</span><span>Missed</span></span>
    </div>
    {!visible.length && <p className="game-tracker-empty">No plotted shots available for this period.</p>}
    {selected && <div className="basketball-shot-detail" aria-live="polite">
      {(selected.teamId === away.id ? away.logo : home.logo) && <Image unoptimized className="basketball-shot-detail-logo" src={(selected.teamId === away.id ? away.logo : home.logo)!} alt="" width={30} height={30} />}
      <div className="basketball-shot-detail-copy">
        <span>{basketballPeriodLabel(selected.period, college)} · {selected.clock}</span>
        <p>{selected.text}</p>
        {selected.awayScore != null && selected.homeScore != null && <strong>{away.name} {selected.awayScore} – {selected.homeScore} {home.name}</strong>}
      </div>
    </div>

  </section>;
}
