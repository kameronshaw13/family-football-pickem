"use client";

import { basketballPeriodLabel, type BasketballShot } from "@/lib/basketballShots";
import { playTextWithoutDuplicateClock } from "@/lib/playText";

type Side = "away" | "home";
type Action = { id: string; text: string; side: Side | null; period: number; clock: string };
type Play = { id: string; text: string; period: number; clock: string; awayScore: number | null; homeScore: number | null };

export default function BasketballLiveCourt({ shots, plays, possessionSide, latestAction, away, home, awayId, homeId, college }: {
  shots: BasketballShot[];
  plays: Play[];
  possessionSide: Side | null;
  latestAction: Action | null;
  away: string;
  home: string;
  awayId: string;
  homeId: string;
  college: boolean;
}) {
  const names = { away, home };
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
      <span>Latest play{latestAction ? ` · ${basketballPeriodLabel(latestAction.period, college)} · ${latestAction.clock}` : ""}</span>
      <strong>{latestAction ? playTextWithoutDuplicateClock(latestAction.text, latestAction.clock) : "Waiting for the next play…"}</strong>
    </div>
    <div className="basketball-live-possession" aria-live="polite">
      <strong>{possessionSide ? `${names[possessionSide]} ball` : "Possession unavailable"}</strong>
    </div>
    <div className="basketball-simple-court-wrap">
      <svg className="basketball-simple-court" viewBox="-1 -1 52 49" role="img" aria-label={latest ? `Last shot: ${latest.player}, ${latest.made ? "made" : "missed"} for ${latest.teamId === awayId ? away : home} at ESPN court coordinates ${latest.x}, ${latest.y}` : "Half basketball court. Last shot coordinates unavailable."}>
        <rect x="0" y="0" width="50" height="47" className="basketball-court-floor" />
        <g className="basketball-simple-lines">
          <rect x="0" y="0" width="50" height="47" />
          <path d="M17 0V19H33V0 M22 4H28 M21 5.25A4 4 0 0 0 29 5.25" />
          <circle cx="25" cy="5.25" r=".75" />
          <circle cx="25" cy="19" r="6" />
          <path d={college
            ? "M3.333 0V5.38 A22.1458 22.1458 0 0 0 46.667 5.38 V0"
            : "M3 0V6.55 A23.75 23.75 0 0 0 47 6.55 V0"} />
          <path d="M0 47H50" /><path d="M19 47A6 6 0 0 1 31 47" />
        </g>
        {latest && shotX != null && shotY != null && <g className={`basketball-latest-shot ${latest.made ? "made" : "missed"}`} transform={`translate(${shotX} ${shotY})`}>
          {latest.made
            ? <circle r="1.2" />
            : <path d="M-1.3 -1.3L1.3 1.3 M-1.3 1.3L1.3 -1.3" />}
        </g>}
      </svg>
      <div className="basketball-last-shot">
        {latest
          ? <><span className={latest.made ? "made" : "missed"}>{latest.made ? "●" : "×"}</span><strong>{latest.player}</strong><span>{latest.made ? "Made" : "Missed"} · {latest.clock} · {latest.teamId === awayId ? away : home}</span></>
          : <span>No shot coordinates available yet</span>}
      </div>
    </div>
    <div className="basketball-last-plays">
      <h3>Last 5 plays</h3>
      {recentPlays.length ? recentPlays.map((play) => <div className="basketball-last-play" key={play.id}>
        <time>{basketballPeriodLabel(play.period, college)} · {play.clock}</time>
        <span>{playTextWithoutDuplicateClock(play.text, play.clock)}</span>
      </div>) : <p className="muted">No earlier plays yet.</p>}
    </div>
    <div className="basketball-score-flow">
      <h3>Score Flow</h3>
      <div className="basketball-flow-legend"><span>{away} leads ↑</span><span>{home} leads ↓</span></div>
      {diffs.length > 1 ? <svg viewBox="0 0 320 102" role="img" aria-label="Score margin progression from ESPN play-by-play; upward means away team leads and downward means home team leads">
        <line x1="12" y1="51" x2="308" y2="51" className="basketball-flow-zero" />
        <path d={path} className="basketball-flow-line" />
        <circle cx="308" cy={51 - diffs[diffs.length - 1] / maxMargin * 37} r="2.4" className="basketball-flow-end" />
      </svg> : <p className="muted">Score flow appears as scoring data becomes available.</p>}
      <div className="basketball-flow-time"><span>Tipoff</span><span>Latest</span></div>
    </div>
  </section>;
}
