"use client";

import { basketballPeriodLabel, type BasketballShot } from "@/lib/basketballShots";
import { playTextWithoutDuplicateClock } from "@/lib/playText";

type Side = "away" | "home";
type Action = { id: string; text: string; side: Side | null; period: number; clock: string };

export default function BasketballLiveCourt({ shots, possessionSide, latestAction, away, home, awayId, homeId, college }: {
  shots: BasketballShot[];
  possessionSide: Side | null;
  latestAction: Action | null;
  away: string;
  home: string;
  awayId: string;
  homeId: string;
  college: boolean;
}) {
  const names = { away, home };
  const recent = shots.filter((shot) => shot.teamId === awayId || shot.teamId === homeId).slice(-8);
  return <section className="basketball-live-view" aria-label="Live basketball court and latest play">
    <div className={`basketball-live-possession ${possessionSide || "unknown"}`} aria-live="polite">
      <span aria-hidden="true">●</span>
      <strong>{possessionSide ? `${names[possessionSide]} ball` : "Possession unavailable"}</strong>
      {possessionSide && <b aria-hidden="true">{possessionSide === "away" ? "←" : "→"}</b>}
    </div>
    <div className={`basketball-live-court ${possessionSide || "unknown"}`} role="img" aria-label={`Full court. ${possessionSide ? `${names[possessionSide]} has the ball.` : "Possession is unavailable."} Recent shots are listed below.`}>
      <svg viewBox="0 0 940 500" preserveAspectRatio="none" aria-hidden="true">
        <rect x="4" y="4" width="932" height="492" rx="6" />
        <path d="M470 4V496 M4 130H194V370H4 M936 130H746V370H936" />
        <circle cx="470" cy="250" r="62" /><circle cx="194" cy="250" r="60" /><circle cx="746" cy="250" r="60" />
        <path d="M4 45 A220 220 0 0 1 4 455 M936 45 A220 220 0 0 0 936 455" />
        <path d="M54 225V275 M886 225V275" /><circle cx="65" cy="250" r="10" /><circle cx="875" cy="250" r="10" />
      </svg>
      <span className="basketball-live-team away">{away}</span>
      <span className="basketball-live-team home">{home}</span>
      {possessionSide && <span className={`basketball-live-flow ${possessionSide}`} aria-hidden="true">{possessionSide === "away" ? "← ATTACK" : "ATTACK →"}</span>}
      {recent.map((shot, index) => {
        const side: Side = shot.teamId === awayId ? "away" : "home";
        return <span key={shot.id} className={`basketball-live-shot ${side} ${shot.made ? "made" : "missed"} ${index === recent.length - 1 ? "latest" : ""}`}
          style={{ left: `${side === "away" ? 5 + shot.y * .95 : 95 - shot.y * .95}%`, top: `${Math.max(5, Math.min(95, shot.x * 2))}%`, opacity: .48 + index / Math.max(1, recent.length) * .52 }}
          aria-hidden="true">{shot.made ? "●" : "×"}</span>;
      })}
      {!recent.length && <span className="basketball-live-waiting">Shots appear as the game unfolds</span>}
    </div>
    <div className="basketball-live-legend"><span><i className="made" /> Made</span><span><i className="missed" /> Missed</span><span>Last {recent.length} shots</span></div>
    {recent.length > 0 && <ol className="basketball-live-recent" aria-label="Most recent shots">{[...recent].reverse().slice(0, 4).map((shot) => <li key={shot.id}><span>{shot.clock} · {shot.teamId === awayId ? away : home}</span><strong>{shot.player}</strong><span>{shot.made ? "Made" : "Missed"}</span></li>)}</ol>}
    <div className="basketball-live-action" aria-live="polite">
      <span>Latest play{latestAction ? ` · ${basketballPeriodLabel(latestAction.period, college)} ${latestAction.clock}` : ""}</span>
      <strong>{latestAction ? playTextWithoutDuplicateClock(latestAction.text, latestAction.clock) : "Waiting for the next play…"}</strong>
    </div>
  </section>;
}
