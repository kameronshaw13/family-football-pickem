"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { AppSlug } from "@/lib/rulePresentation";

type ActivityLeague = "shaw-family" | "friends";
type Visit = { id: string; name: string; openedAt: string };
const visitDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  month: "short",
  day: "numeric",
  year: "numeric"
});

const visitDayKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit"
});

export default function AppOpenActivity({ appSlug }: { appSlug: AppSlug }) {
  const [league, setLeague] = useState<ActivityLeague>(appSlug === "friends" ? "friends" : "shaw-family");
  const [visits, setVisits] = useState<Visit[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);

  const refresh = useCallback(() => setRefreshCount((count) => count + 1), []);
  // One entry per person per Central Time calendar day.
  const dailyVisits = useMemo(() => {
    const seen = new Set<string>();
    return visits.filter((visit) => {
      const key = `${visit.name.trim().toLowerCase()}|${visitDayKey.format(new Date(visit.openedAt))}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [visits]);
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
        <span>Private to Kameron · One entry per person each day</span>
      </div>
      <button type="button" className="app-open-refresh" aria-label="Refresh app activity" title="Refresh" disabled={busy} onClick={refresh}><RefreshCw size={16} /></button>
    </div>
    <div className="theme-toggle" role="group" aria-label="Choose activity league">
      <button type="button" className={league === "shaw-family" ? "active" : ""} aria-pressed={league === "shaw-family"} onClick={() => setLeague("shaw-family")}>Shaw</button>
      <button type="button" className={league === "friends" ? "active" : ""} aria-pressed={league === "friends"} onClick={() => setLeague("friends")}>Friends</button>
    </div>
    <div className="app-open-activity-list" aria-live="polite">
      {busy ? <p className="muted">Loading activity…</p>
        : error ? <p className="muted" role="alert">{error}</p>
        : visits.length === 0 ? <p className="muted">No app opens recorded yet.</p>
        : dailyVisits.map((visit) => <div className="app-open-activity-item" key={visit.id}>
          <strong>{visit.name || "Player"}</strong>
          <time dateTime={visit.openedAt}>{visitDate.format(new Date(visit.openedAt))}</time>
        </div>)}
    </div>
  </div>;
}
