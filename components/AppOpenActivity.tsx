"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

type ActivityLeague = "shaw-family" | "friends" | "friends-basketball";
type Visit = { id: string; name: string; openedAt: string; eventType: "league_open" | "league_card_view" };
type ActivityEntry = { visits: Visit[]; error: string; busy: boolean };
const LEAGUES: Array<{ slug: ActivityLeague; name: string }> = [
  { slug: "shaw-family", name: "Shaw Football" },
  { slug: "friends", name: "Just Cover Football" },
  { slug: "friends-basketball", name: "Just Cover Basketball" }
];
const visitDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit"
});
const emptyEntry = (): ActivityEntry => ({ visits: [], error: "", busy: true });
const initialEntries = (): Record<ActivityLeague, ActivityEntry> => ({
  "shaw-family": emptyEntry(),
  "friends": emptyEntry(),
  "friends-basketball": emptyEntry()
});

export default function AppOpenActivity() {
  const [entries, setEntries] = useState<Record<ActivityLeague, ActivityEntry>>(initialEntries);
  const [refreshCount, setRefreshCount] = useState(0);
  const refresh = useCallback(() => setRefreshCount((count) => count + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setEntries(initialEntries());
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) {
      setEntries(Object.fromEntries(LEAGUES.map(({ slug }) => [slug, {
        visits: [], busy: false, error: "Sign in again to view activity."
      }])) as Record<ActivityLeague, ActivityEntry>);
      return;
    }
    for (const { slug } of LEAGUES) {
      void (async () => {
        try {
          const response = await fetch(`/api/app-open?league=${slug}&eventType=all`, {
            headers: { Authorization: `Bearer ${token}`, "x-pickem-group": slug },
            cache: "no-store",
            signal: controller.signal
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || "Could not load activity.");
          if (!controller.signal.aborted) setEntries((previous) => ({
            ...previous,
            [slug]: { visits: Array.isArray(payload.visits) ? payload.visits : [], busy: false, error: "" }
          }));
        } catch (cause) {
          if (!controller.signal.aborted) setEntries((previous) => ({
            ...previous,
            [slug]: { visits: [], busy: false, error: cause instanceof Error ? cause.message : "Could not load activity." }
          }));
        }
      })();
    }
    return () => controller.abort();
  }, [refreshCount]);

  return <div className="settings-card app-open-activity">
    <div className="app-open-activity-header">
      <div className="settings-row-copy">
        <strong>League Activity</strong>
        <span>Private · Rolling last 24 hours · League Card views and opens</span>
      </div>
      <button type="button" className="app-open-refresh" aria-label="Refresh league activity" title="Refresh" onClick={refresh}><RefreshCw size={16} /></button>
    </div>
    {LEAGUES.map(({ slug, name }) => {
      const entry = entries[slug];
      return <section className="app-activity-league" key={slug} aria-label={name}>
        <h3>{name}</h3>
        <div className="app-open-activity-list" aria-live="polite">
          {entry.busy ? <p className="muted">Loading activity…</p>
            : entry.error ? <p className="muted" role="alert">{entry.error}</p>
            : entry.visits.length === 0 ? <p className="muted">No recorded activity in the last 24 hours.</p>
            : entry.visits.map((visit) => <div className="app-open-activity-item" key={visit.id}>
              <strong>{visit.name || "Player"}</strong>
              <span className="app-activity-action">{visit.eventType === "league_card_view" ? "League Card" : "Opened league"}</span>
              <time dateTime={visit.openedAt}>{visitDate.format(new Date(visit.openedAt))}</time>
            </div>)}
        </div>
      </section>;
    })}
  </div>;
}
