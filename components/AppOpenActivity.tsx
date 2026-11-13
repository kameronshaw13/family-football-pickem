"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { AppSlug } from "@/lib/rulePresentation";

type ActivityLeague = "shaw-family" | "friends" | "friends-basketball";
type Visit = { id: string; name: string; openedAt: string };
type ActivityType = "league_open" | "league_card_view";
const visitDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit"
});

export default function AppOpenActivity({ appSlug }: { appSlug: AppSlug }) {
  const [league, setLeague] = useState<ActivityLeague>(appSlug === "friends-basketball" ? "friends-basketball" : appSlug === "friends" ? "friends" : "shaw-family");
  const [visits, setVisits] = useState<Visit[]>([]);
  const [activityType, setActivityType] = useState<ActivityType>("league_card_view");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);

  const selectLeague = (nextLeague: ActivityLeague) => {
    if (nextLeague === league) return;
    setBusy(true);
    setError("");
    setVisits([]);
    setLeague(nextLeague);
  };

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
        const response = await fetch(`/api/app-open?league=${league}&eventType=${activityType}`, {
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
  }, [league, activityType, refreshCount]);

  return <div className="settings-card app-open-activity">
    <div className="app-open-activity-header">
      <div className="settings-row-copy">
        <strong>League Activity</strong>
        <span>Private to Kameron · Rolling last 24 hours</span>
      </div>
      <button type="button" className="app-open-refresh" aria-label="Refresh app activity" title="Refresh" disabled={busy} onClick={refresh}><RefreshCw size={16} /></button>
    </div>
    <div className="theme-toggle app-open-league-toggle" role="group" aria-label="Choose activity league">
      <button type="button" className={league === "shaw-family" ? "active" : ""} aria-pressed={league === "shaw-family"} onClick={() => selectLeague("shaw-family")}>Shaw Football</button>
      <button type="button" className={league === "friends" ? "active" : ""} aria-pressed={league === "friends"} onClick={() => selectLeague("friends")}>Just Cover Football</button>
      <button type="button" className={league === "friends-basketball" ? "active" : ""} aria-pressed={league === "friends-basketball"} onClick={() => selectLeague("friends-basketball")}>Just Cover Basketball</button>
    </div>
    <div className="theme-toggle app-open-league-toggle" role="group" aria-label="Choose activity type">
      <button type="button" className={activityType === "league_card_view" ? "active" : ""} aria-pressed={activityType === "league_card_view"} onClick={() => { setVisits([]); setActivityType("league_card_view"); }}>League Card Views</button>
      <button type="button" className={activityType === "league_open" ? "active" : ""} aria-pressed={activityType === "league_open"} onClick={() => { setVisits([]); setActivityType("league_open"); }}>League Opens</button>
    </div>
    <div className="app-open-activity-list" aria-live="polite">
      {busy ? <p className="muted">Loading activity…</p>
        : error ? <p className="muted" role="alert">{error}</p>
        : visits.length === 0 ? <p className="muted">No {activityType === "league_card_view" ? "League Card views" : "league opens"} recorded in the last 24 hours.</p>
        : visits.map((visit) => <div className="app-open-activity-item" key={visit.id}>
          <strong>{visit.name || "Player"}</strong>
          <time dateTime={visit.openedAt}>{visitDate.format(new Date(visit.openedAt))}</time>
        </div>)}
    </div>
  </div>;
}
