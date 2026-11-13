"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

type ActivityLeague = "shaw-family" | "friends" | "friends-basketball";
type Visit = { id: string; name: string; openedAt: string };
const LEAGUES: Array<{ slug: ActivityLeague; name: string }> = [
  { slug: "shaw-family", name: "Shaw Football" },
  { slug: "friends", name: "Just Cover Football" },
  { slug: "friends-basketball", name: "Just Cover Basketball" }
];
const visitDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
});

export default function AppOpenActivity() {
  const [league, setLeague] = useState<ActivityLeague>("shaw-family");
  const [visits, setVisits] = useState<Visit[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [refreshCount, setRefreshCount] = useState(0);
  const refresh = useCallback(() => setRefreshCount((count) => count + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError("");
    setVisits([]);
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) {
      setError("Sign in again to view League Card activity.");
      setBusy(false);
      return;
    }
    void (async () => {
      try {
        const response = await fetch(`/api/app-open?league=${league}&eventType=league_card_view`, {
          headers: { Authorization: `Bearer ${token}`, "x-pickem-group": league },
          cache: "no-store", signal: controller.signal
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load League Card views.");
        if (!controller.signal.aborted) setVisits(Array.isArray(payload.visits) ? payload.visits : []);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load League Card views.");
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    })();
    return () => controller.abort();
  }, [league, refreshCount]);

  return <div className="settings-card app-open-activity">
    <div className="app-open-activity-header">
      <div className="settings-row-copy">
        <strong>League Card Activity</strong>
        <span>Private · Actual League Card visits · Rolling last 24 hours</span>
      </div>
      <button type="button" className="app-open-refresh" aria-label="Refresh League Card activity" title="Refresh" onClick={refresh}><RefreshCw size={16}/></button>
    </div>
    <div className="theme-toggle app-open-league-toggle" role="group" aria-label="Choose league">
      {LEAGUES.map(({slug,name}) => <button type="button" key={slug} className={league === slug ? "active" : ""} aria-pressed={league === slug} onClick={() => setLeague(slug)}>{name}</button>)}
    </div>
    <div className="app-open-activity-list" aria-live="polite">
      {busy ? <p className="muted">Loading League Card views…</p>
        : error ? <p className="muted" role="alert">{error}</p>
        : visits.length === 0 ? <p className="muted">No one viewed this League Card section in the last 24 hours.</p>
        : visits.map((visit) => <div className="app-open-activity-item" key={visit.id}>
          <strong>{visit.name || "Player"}</strong>
          <time dateTime={visit.openedAt}>{visitDate.format(new Date(visit.openedAt))}</time>
        </div>)}
    </div>
  </div>;
}
