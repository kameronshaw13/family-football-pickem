"use client";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { Game } from "@/lib/types";
import type { LineMovementPoint } from "@/lib/lineMovement";
import { spreadText } from "@/lib/spreads";
import { teamDisplayName } from "@/lib/teamNames";

const dateFormat = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
export default function LineMovement({ game }: { game: Game }) {
  const [points, setPoints] = useState<LineMovementPoint[] | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setPoints(null); setError("");
    const token = window.localStorage.getItem("pickem_session_token") || "";
    let inFlight = false;
    async function refresh() {
      if (inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const response = await fetch(`/api/line-movement?gameId=${encodeURIComponent(game.id)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(25_000) });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.points)) throw new Error(data.error || "Could not load line movement.");
        if (active) { setPoints(data.points); setError(""); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load line movement.");
      } finally { inFlight = false; }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    const resume = () => void refresh();
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [game.id, retry]);
  if (error && !points) return <div className="matchup-empty-copy" role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div>;
  if (!points) return <div className="matchup-preview-loading" role="status"><LoaderCircle size={22} /><span>Loading line movement…</span></div>;
  return <section className="line-movement-panel">
    <div className="matchup-section-heading"><h3>Line Movement</h3></div>
    <p className="line-movement-note"><span>Recorded spread changes</span><span className="ui-separator-dot" aria-hidden="true">·</span><span>Central time</span></p>
    {points.length ? <>
      <div className="line-movement-columns"><span>Date / Time</span><strong>{teamDisplayName(game.league, game.away_team)}</strong><strong>{teamDisplayName(game.league, game.home_team)}</strong></div>
      {[...points].reverse().map((point, index) => <div className="line-movement-row" key={`${point.at}-${index}`}>
        <div><time dateTime={point.at}>{dateFormat.format(new Date(point.at))} CT</time><small>{point.change == null ? "First recorded" : `Moved ${Math.abs(point.change)} ${Math.abs(point.change) === 1 ? "point" : "points"}`}</small></div>
        <strong>{spreadText(point.awaySpread)}</strong><strong>{spreadText(point.homeSpread)}</strong>
      </div>)}
    </> : <p className="matchup-empty-copy">No spread history has been recorded for this game yet.</p>}
  </section>;
}
