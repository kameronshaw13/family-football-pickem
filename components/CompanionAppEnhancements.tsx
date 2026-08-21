"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import NumericText from "@/components/NumericText";

type AppSlug = "other-family" | "friends";
type Payload = any;
const CACHE_PREFIX = "pickem_app_data_v1:";

function selectedWeek() {
  const trigger = document.querySelector<HTMLButtonElement>('button[aria-label="Select week"]');
  const match = (trigger?.textContent || "").match(/Week\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function latestPayload(slug: AppSlug): Payload | null {
  try {
    let best: { cachedAt: number; payload: Payload } | null = null;
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (!key?.startsWith(CACHE_PREFIX)) continue;
      const parsed = JSON.parse(window.sessionStorage.getItem(key) || "null");
      if (parsed?.payload?.activeGroup?.slug !== slug) continue;
      if (!best || Number(parsed.cachedAt || 0) > best.cachedAt) best = parsed;
    }
    return best?.payload || null;
  } catch {
    return null;
  }
}

function cachePayload(payload: Payload) {
  try {
    let updated = false;
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (!key?.startsWith(CACHE_PREFIX)) continue;
      const parsed = JSON.parse(window.sessionStorage.getItem(key) || "null");
      if (parsed?.payload?.activeGroup?.slug !== payload?.activeGroup?.slug) continue;
      parsed.payload = payload;
      parsed.cachedAt = Date.now();
      window.sessionStorage.setItem(key, JSON.stringify(parsed));
      updated = true;
    }
    if (!updated && payload?.activeGroup?.slug) {
      window.sessionStorage.setItem(
        `${CACHE_PREFIX}companion:${payload.activeGroup.slug}:${Number(payload.week || 0)}`,
        JSON.stringify({ cachedAt: Date.now(), payload })
      );
    }
  } catch {
    // Session storage is only an optimization.
  }
}

function ensureHost(key: string, parent: Element | null, after?: Element | null) {
  if (!parent) return null;
  let host = parent.querySelector<HTMLElement>(`:scope > [data-companion-host="${key}"]`);
  if (host) return host;
  host = document.createElement("div");
  host.dataset.companionHost = key;
  if (after?.parentElement === parent) after.insertAdjacentElement("afterend", host);
  else parent.appendChild(host);
  return host;
}

function pointText(value: number) {
  return `${value} ${value === 1 ? "pt" : "pts"}`;
}

function rebuildPointsLeaderboard(leaderboard: HTMLElement, rows: any[]) {
  leaderboard.classList.add("points-mode");
  const labels = leaderboard.querySelector<HTMLElement>(":scope > .leaderboard-labels");
  if (labels) {
    labels.replaceChildren();
    for (const text of ["Place", "Player", "Points"]) {
      const span = document.createElement("span");
      span.textContent = text;
      labels.appendChild(span);
    }
  }

  const domRows = Array.from(leaderboard.querySelectorAll<HTMLElement>(":scope > .leaderboard-row"));
  const byName = new Map(domRows.map((row) => [row.querySelector(".leaderboard-player strong")?.textContent?.trim().toLowerCase() || "", row]));
  for (let index = 0; index < rows.length; index += 1) {
    const standing = rows[index];
    const row = byName.get(String(standing.display_name || "").trim().toLowerCase());
    if (!row) continue;
    row.querySelectorAll(":scope > .leaderboard-stat, :scope > .leaderboard-pct, :scope > .leaderboard-points").forEach((node) => node.remove());
    const rank = row.querySelector<HTMLElement>(".leaderboard-rank");
    if (rank) {
      rank.textContent = String(standing.rank || index + 1);
      rank.classList.remove("rank-1", "rank-2", "rank-3");
      if (Number(standing.rank) <= 3) rank.classList.add(`rank-${Number(standing.rank)}`);
    }
    const points = document.createElement("strong");
    points.className = "leaderboard-points";
    points.textContent = String(Number(standing.points || 0));
    row.appendChild(points);
    leaderboard.appendChild(row);
  }
}

function syncConfidenceStandings(payload: Payload) {
  if (payload?.activeGroup?.slug !== "other-family") return;
  document.querySelectorAll<HTMLElement>(".standings-panel .leaderboard").forEach((leaderboard) => {
    const weekly = Boolean(leaderboard.closest(".weekly-standings"));
    const rows = weekly
      ? payload.weeklyStandingsByWeek?.[String(payload.week)] || []
      : payload.standings || [];
    rebuildPointsLeaderboard(leaderboard, rows);
  });

  const results = document.querySelector<HTMLElement>(".standings-panel .bank-week-results");
  if (!results) return;
  const labels = results.querySelector<HTMLElement>(":scope > .bank-results-labels");
  if (labels) {
    labels.replaceChildren();
    for (const text of ["Player", "Balance", "Points", ""]) {
      const span = document.createElement("span");
      span.textContent = text;
      labels.appendChild(span);
    }
  }
  const weeklyRows = payload.weeklyStandingsByWeek?.[String(payload.week)] || [];
  const details = Array.from(results.querySelectorAll<HTMLElement>(":scope > .bank-player-result"));
  const byName = new Map(details.map((row) => [row.querySelector(".bank-result-player")?.textContent?.trim().toLowerCase() || "", row]));
  for (const standing of weeklyRows) {
    const row = byName.get(String(standing.display_name || "").trim().toLowerCase());
    if (!row) continue;
    const stat = row.querySelector<HTMLElement>(".bank-result-record");
    if (stat) stat.textContent = `${Number(standing.points || 0)} pts`;
    results.appendChild(row);
  }
}

function hideBaseRules() {
  const base = document.querySelector<HTMLElement>(".rules-panel > .rules-list");
  if (base) base.style.display = "none";
}

function ConfidenceOrder({ payload, onPayload }: { payload: Payload; onPayload: (payload: Payload) => void }) {
  const currentUserId = payload.currentUser?.id;
  const week = Number(payload.week);
  const source = useMemo(
    () => (payload.picks || []).filter((pick: any) => pick.user_id === currentUserId && Number(pick.week) === week && pick.pick_type === "regular"),
    [currentUserId, payload.picks, week]
  );
  const initial = useMemo(() => [...source].sort((a, b) => {
    const pointDiff = Number(b.confidence_points || 0) - Number(a.confidence_points || 0);
    if (pointDiff) return pointDiff;
    const gameA = payload.games?.find((game: any) => game.id === a.game_id) || a.game;
    const gameB = payload.games?.find((game: any) => game.id === b.game_id) || b.game;
    return new Date(gameA?.commence_time || 0).getTime() - new Date(gameB?.commence_time || 0).getTime();
  }), [payload.games, source]);
  const [order, setOrder] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    setOrder(initial);
  }, [initial]);

  function broadcastOrder(next: any[]) {
    window.dispatchEvent(new CustomEvent("pickem:confidence-order-saved", {
      detail: {
        week,
        points: Object.fromEntries(next.map((pick, index) => [pick.game_id, Math.max(1, 5 - index)]))
      }
    }));
  }

  async function persist(next: any[]) {
    setOrder(next);
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) return;
    broadcastOrder(next);
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/confidence-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ week, gameIds: next.map((pick) => pick.game_id) })
      });
      const result = await response.json();
      if (!response.ok) {
        setOrder(initial);
        broadcastOrder(initial);
        setMessage(result.error || "Could not save confidence order.");
        return;
      }
      const points = new Map((result.order || []).map((row: any) => [row.gameId, Number(row.points)]));
      const updated = {
        ...payload,
        picks: (payload.picks || []).map((pick: any) => points.has(pick.game_id) && pick.user_id === currentUserId
          ? { ...pick, confidence_points: points.get(pick.game_id) }
          : pick)
      };
      cachePayload(updated);
      onPayload(updated);
      window.dispatchEvent(new CustomEvent("pickem:confidence-order-saved", {
        detail: { week, points: Object.fromEntries(points) }
      }));
      window.dispatchEvent(new CustomEvent("pickem:companion-refresh"));
    } catch {
      setOrder(initial);
      broadcastOrder(initial);
      setMessage("Could not save confidence order.");
    } finally {
      setSaving(false);
    }
  }

  function targetIndex(index: number, direction: -1 | 1) {
    if (order[index]?.status === "locked") return -1;
    let target = index + direction;
    while (target >= 0 && target < order.length && order[target]?.status === "locked") target += direction;
    return target >= 0 && target < order.length ? target : -1;
  }

  function move(index: number, direction: -1 | 1) {
    const target = targetIndex(index, direction);
    if (saving || target < 0) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    void persist(next);
  }

  if (!source.length) return null;
  return <section className="confidence-order-panel">
    <div className="confidence-order-head">
      <strong>Confidence Order</strong>
      {saving && <span>Saving…</span>}
    </div>
    <div className="confidence-order-list">
      {order.map((pick: any, index) => {
        const points = Math.max(1, 5 - index);
        const pickLocked = pick.status === "locked";
        return <div className={`confidence-order-row${pickLocked ? " locked" : ""}`} data-confidence-game-id={pick.game_id} key={pick.game_id}>
          <span className="confidence-value"><NumericText text={pointText(points)} /></span>
          <strong>{pick.selected_team}</strong>
          <span className="confidence-move">
            <button type="button" aria-label={`Move ${pick.selected_team} up`} disabled={saving || pickLocked || targetIndex(index, -1) < 0} onClick={() => move(index, -1)}><ChevronUp size={15} /></button>
            <button type="button" aria-label={`Move ${pick.selected_team} down`} disabled={saving || pickLocked || targetIndex(index, 1) < 0} onClick={() => move(index, 1)}><ChevronDown size={15} /></button>
          </span>
        </div>;
      })}
    </div>
    {message && <p className="confidence-error">{message}</p>}
  </section>;
}

export default function CompanionAppEnhancements({ slug }: { slug: AppSlug }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [confidenceHost, setConfidenceHost] = useState<HTMLElement | null>(null);
  const refreshingRef = useRef(false);

  const refreshPayload = useCallback(async () => {
    if (refreshingRef.current) return;
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) return;
    refreshingRef.current = true;
    try {
      const url = new URL("/api/app-data", window.location.origin);
      const week = selectedWeek();
      if (week != null) url.searchParams.set("week", String(week));
      const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok) return;
      const next = await response.json();
      if (next?.activeGroup?.slug !== slug) return;
      cachePayload(next);
      setPayload(next);
    } catch {
      // The base app remains usable if a companion refresh fails.
    } finally {
      refreshingRef.current = false;
    }
  }, [slug]);

  const apply = useCallback(() => {
    const nextPayload = latestPayload(slug);
    if (nextPayload) {
      setPayload(nextPayload);
      if (slug === "other-family") {
        syncConfidenceStandings(nextPayload);
      }
    }

    if (slug === "other-family") {
      const pickSection = document.querySelector(".card-panel .pick-section");
      const pickTitle = pickSection?.querySelector(":scope > h3") || null;
      setConfidenceHost(ensureHost("confidence", pickSection, pickTitle));
    }

    const rulesPanel = document.querySelector<HTMLElement>(".rules-panel");
    if (rulesPanel) hideBaseRules();

  }, [slug]);

  useEffect(() => {
    let active = true;
    const timers = new Set<number>();
    const schedule = (delay: number) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (active) apply();
      }, delay);
      timers.add(timer);
    };
    const scheduleRefresh = (delay: number) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (active) void refreshPayload();
      }, delay);
      timers.add(timer);
    };
    const burst = () => [0, 60, 180, 450, 900, 1500].forEach(schedule);
    [0, 160, 500, 1000, 1800, 3000].forEach(schedule);
    scheduleRefresh(550);

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const relevant = target.closest(".primary-nav button, .section-tabs button, .custom-select-option, .team-row.selectable, .pick-row-actions button, .side-bet-slip-bar, .side-bet-card .actions button, .confirmation-actions button, .confidence-move button");
      if (!relevant) return;
      burst();
      scheduleRefresh(target.closest(".team-row.selectable, .pick-row-actions button") ? 700 : 220);
    };
    const onRefresh = () => {
      burst();
      scheduleRefresh(120);
    };
    const onFocus = () => {
      burst();
      scheduleRefresh(100);
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      burst();
      scheduleRefresh(100);
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("pickem:companion-refresh", onRefresh);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      active = false;
      timers.forEach((timer) => window.clearTimeout(timer));
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("pickem:companion-refresh", onRefresh);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [apply, refreshPayload]);

  useEffect(() => {
    if (!payload) return;
    if (slug === "other-family") {
      syncConfidenceStandings(payload);
    }
  }, [payload, slug]);

  return <>
    {slug === "other-family" && payload && confidenceHost && createPortal(<ConfidenceOrder payload={payload} onPayload={setPayload} />, confidenceHost)}
  </>;
}
