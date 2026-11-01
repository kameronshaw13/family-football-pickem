"use client";

import { useState } from "react";
import MenuSelect from "@/components/MenuSelect";
import { basketballPeriodLabel, filterBasketballShots, type BasketballShot } from "@/lib/basketballShots";

type Team = { id: string; name: string };
export default function BasketballShotChart({ shots, attempts, college, period, away, home }: {
  shots: BasketballShot[]; attempts: number; college: boolean; period: number; away: Team; home: Team;
}) {
  const [teamId, setTeamId] = useState("all");
  const [selectedPeriod, setSelectedPeriod] = useState("current");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const current = Math.max(1, period);
  const periods = Array.from({ length: Math.max(current, ...shots.map(shot => shot.period), college ? 2 : 4) }, (_, i) => i + 1);
  const visible = filterBasketballShots(shots, teamId, selectedPeriod, current);
  const selected = visible.find(shot => shot.id === selectedId);
  const made = visible.filter(shot => shot.made).length;
  const radius = college ? 22.1458 : 23.75;
  const corner = college ? 3.3333 : 3;
  const arcY = 5.25 + Math.sqrt(radius ** 2 - (25 - corner) ** 2);
  // Half court by default; extend the actual court for long heaves rather than relocating a shot.
  const courtLength = visible.some(shot => shot.y > 47) ? 94 : 47;
  return <section className="basketball-shot-chart" aria-label="Shot chart">
    <div className="matchup-section-heading"><h3>Shot Chart</h3><span>{made}/{visible.length} FG</span></div>
    <div className="basketball-shot-filters">
      <div className="game-tracker-box-selector" role="group" aria-label="Shot chart team">
        {[away, { id: "all", name: "All" }, home].map(team => <button type="button" key={team.id} className={teamId === team.id ? "active" : ""} aria-pressed={teamId === team.id} onClick={() => { setTeamId(team.id); setSelectedId(null); }}>{team.name}</button>)}
      </div>
      <MenuSelect className="compact-select basketball-period-select" plainText ariaLabel="Shot chart period" value={selectedPeriod} onChange={value => { setSelectedPeriod(value); setSelectedId(null); }} sections={[{ options: [
        { value: "current", label: `Current · ${basketballPeriodLabel(current, college)}` }, { value: "all", label: "All periods" },
        ...periods.map(value => ({ value: String(value), label: basketballPeriodLabel(value, college) }))
      ] }]} />
    </div>
    <p className="basketball-shot-key"><span className="shot-key-made">○ Made</span><span className="shot-key-missed">× Missed</span><span>Tap a shot for details</span></p>
    <svg className="basketball-court" viewBox={`-1 -1 52 ${courtLength + 2}`} aria-label="Basketball court with available shot locations">
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
      {visible.map(shot => <g key={shot.id} className={`basketball-shot ${shot.made ? "made" : "missed"} ${shot.id === selectedId ? "selected" : ""}`} transform={`translate(${shot.x} ${shot.y})`} role="button" tabIndex={0}
        aria-label={`${shot.player}: ${shot.made ? "made" : "missed"}, ${basketballPeriodLabel(shot.period, college)}, ${shot.clock}`}
        aria-pressed={shot.id === selectedId} onClick={() => setSelectedId(shot.id)} onKeyDown={event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); setSelectedId(shot.id); } }}>
        <title>{shot.text}</title><circle r="1.8" fill="transparent" stroke="none" />
        {shot.made ? <circle r=".55" fill="none" strokeWidth=".3" /> : <path d="M-.5-.5L.5.5 M-.5.5L.5-.5" strokeWidth=".3" />}
      </g>)}
    </svg>
    {!visible.length && <p className="game-tracker-empty">No shot locations available for this selection yet.</p>}
    {selected && <div className="basketball-shot-detail" aria-live="polite"><strong>{selected.player}</strong><span>{selected.teamId === away.id ? away.name : selected.teamId === home.id ? home.name : ""} · {basketballPeriodLabel(selected.period, college)} · {selected.clock}</span><p>{selected.text}</p><b>{away.name} {selected.awayScore ?? "—"}–{selected.homeScore ?? "—"} {home.name}</b></div>}
    {attempts > shots.length && <p className="matchup-data-note">Locations are available for {shots.length} of {attempts} field-goal attempts.</p>}
  </section>;
}
