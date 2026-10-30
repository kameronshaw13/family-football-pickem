"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { AppSlug } from "@/lib/rulePresentation";

type ActivityLeague = "shaw-family" | "friends" | "friends-basketball";
type Visit = { id: string; name: string; openedAt: string };
const visitDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  hour: "numeric",
  minute: "2-digit"
});

export default function AppOpenActivity({ appSlug }: { appSlug: AppSlug }) {
  const [league, setLeague] = useState<ActivityLeague>(appSlug === "friends-basketball" ? "friends-basketball" : appSlug === "friends" ? "friends" : "shaw-family");
  const [visits, setVisits] = useState<Visit[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);

  const refresh = useCallback(() => setRefreshCount((count) => count + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) {
      setError("Sign in again to view activity.");
      setBusy(false);
      return;
    }
    const load = async () => {
      setBusy(true);
      setError("");
      try {
        const response = await fetch(`/api/app-open?league=${league}`, {
          headers: { Authorization: `Bearer ${token}`, "x-pickem-group": league },
          cache: "no-store",
          signal: controller.signal
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load activity.");
        if (!controller.signal.aborted) setVisits(Array.isArray(payload.visits) ? payload.visits : []);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load activity.");
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [league, refreshCount]);

  return <div className="settings-card app-open-activity">
    <div className="app-open-activity-header">
      <div className="settings-row-copy">
        <strong>Who Opened the App</strong>
        <span>Private to Kameron · Every recorded opening since midnight CT</span>
      </div>
      <button type="button" className="app-open-refresh" aria-label="Refresh app activity" title="Refresh" disabled={busy} onClick={refresh}><RefreshCw size={16} /></button>
    </div>
    <div className="theme-toggle app-open-league-toggle" role="group" aria-label="Choose activity league">
      <button type="button" className={league === "shaw-family" ? "active" : ""} aria-pressed={league === "shaw-family"} onClick={() => setLeague("shaw-family")}>Shaw Football</button>
      <button type="button" className={league === "friends" ? "active" : ""} aria-pressed={league === "friends"} onClick={() => setLeague("friends")}>Just Cover Football</button>
      <button type="button" className={league === "friends-basketball" ? "active" : ""} aria-pressed={league === "friends-basketball"} onClick={() => setLeague("friends-basketball")}>Just Cover Basketball</button>
    </div>
    <div className="app-open-activity-list" aria-live="polite">
      {busy ? <p className="muted">Loading activity…</p>
        : error ? <p className="muted" role="alert">{error}</p>
        : visits.length === 0 ? <p className="muted">No app opens recorded today.</p>
        : visits.map((visit) => <div className="app-open-activity-item" key={visit.id}>
          <strong>{visit.name || "Player"}</strong>
          <time dateTime={visit.openedAt}>{visitDate.format(new Date(visit.openedAt))}</time>
        </div>)}
    </div>
  </div>;
}
