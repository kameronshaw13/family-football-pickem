"use client";

import { useEffect } from "react";
import type { AppSlug } from "@/lib/rulePresentation";

const APP_DATA_CACHE_PREFIX = "pickem_app_data_v1";

type CachedGame = {
  lock_time?: string | null;
  commence_time?: string | null;
};

type CachedPick = {
  user_id?: string | null;
  week?: number | null;
  selected_team?: string | null;
  status?: string | null;
  locked_spread?: number | null;
};

type CachedPayload = {
  week?: number | null;
  currentUser?: { id?: string | null } | null;
  games?: CachedGame[];
  picks?: CachedPick[];
};

function selectedWeekFromHeader() {
  const text = document.querySelector<HTMLElement>(".week-select-wrap .custom-select-trigger")?.textContent || "";
  const match = text.match(/Week\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function cacheKeys(appSlug: AppSlug) {
  const week = selectedWeekFromHeader();
  return [
    `${APP_DATA_CACHE_PREFIX}:${appSlug}:${week == null ? "default" : week}`,
    `${APP_DATA_CACHE_PREFIX}:${appSlug}:default`
  ];
}

function readCachedPayload(appSlug: AppSlug): CachedPayload | null {
  const selectedWeek = selectedWeekFromHeader();
  for (const key of cacheKeys(appSlug)) {
    try {
      const raw = window.sessionStorage.getItem(key);
      if (!raw) continue;
      const entry = JSON.parse(raw) as { payload?: CachedPayload } | null;
      const payload = entry?.payload;
      if (!payload) continue;
      if (selectedWeek != null && payload.week != null && Number(payload.week) !== selectedWeek) continue;
      return payload;
    } catch {
      // Ignore malformed or stale cache entries.
    }
  }
  return null;
}

function writeLockedStatusToCache(appSlug: AppSlug, selectedTeam: string, week: number | null, lockedSpread?: number | null) {
  for (const key of cacheKeys(appSlug)) {
    try {
      const raw = window.sessionStorage.getItem(key);
      if (!raw) continue;
      const entry = JSON.parse(raw) as { payload?: CachedPayload; cachedAt?: number } | null;
      const payload = entry?.payload;
      if (!payload?.picks?.length) continue;
      const currentUserId = payload.currentUser?.id;
      let changed = false;
      payload.picks = payload.picks.map((pick) => {
        const sameUser = !currentUserId || pick.user_id === currentUserId;
        const sameWeek = week == null || pick.week == null || Number(pick.week) === week;
        if (sameUser && sameWeek && pick.selected_team === selectedTeam) {
          const nextLockedSpread = lockedSpread ?? pick.locked_spread ?? null;
          if (pick.status !== "locked" || pick.locked_spread !== nextLockedSpread) changed = true;
          return { ...pick, status: "locked", locked_spread: nextLockedSpread };
        }
        return pick;
      });
      if (changed) window.sessionStorage.setItem(key, JSON.stringify({ ...entry, payload }));
    } catch {
      // Cache syncing is best-effort only.
    }
  }
}

function universalWeekendLockTime(games: CachedGame[]) {
  const candidates = games.flatMap((game) => {
    const lock = new Date(game.lock_time || "").getTime();
    const kickoff = new Date(game.commence_time || "").getTime();
    if (!Number.isFinite(lock) || !Number.isFinite(kickoff) || lock >= kickoff - 60_000) return [];
    return [lock];
  });
  if (!candidates.length) return null;

  const counts = new Map<number, number>();
  for (const value of candidates) counts.set(value, (counts.get(value) || 0) + 1);
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || right[0] - left[0])[0]?.[0] ?? null;
}

function normalizeTeam(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function teamMatches(rawTeam: string, displayedTeam: string) {
  const raw = normalizeTeam(rawTeam);
  const displayed = normalizeTeam(displayedTeam);
  if (!raw || !displayed) return false;
  return raw === displayed || raw.includes(displayed) || displayed.includes(raw);
}

function displayedTeamForRow(row: HTMLElement) {
  const responsive = row.querySelector<HTMLElement>(".pick-title-team .responsive-text");
  const direct = row.querySelector<HTMLElement>(".pick-title-team");
  return (responsive?.getAttribute("aria-label") || direct?.getAttribute("aria-label") || direct?.textContent || "").trim();
}

function lockIconMarkup() {
  return `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
}

export default function LockedPickIconSync({ appSlug }: { appSlug: AppSlug }) {
  useEffect(() => {
    const confirmedThisSession = new Set<string>();
    let frame = 0;
    let applying = false;
    const originalFetch = window.fetch;

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(apply);
    };

    const apply = () => {
      frame = 0;
      if (applying) return;
      applying = true;
      try {
        const payload = readCachedPayload(appSlug);
        const selectedWeek = selectedWeekFromHeader();
        const currentUserId = payload?.currentUser?.id;
        const lockedTeams = new Set(confirmedThisSession);

        for (const pick of payload?.picks || []) {
          const sameUser = !currentUserId || pick.user_id === currentUserId;
          const sameWeek = selectedWeek == null || pick.week == null || Number(pick.week) === selectedWeek;
          if (sameUser && sameWeek && pick.status === "locked" && pick.selected_team) lockedTeams.add(pick.selected_team);
        }

        const universalLockAt = universalWeekendLockTime(payload?.games || []);
        const universalLockReached = universalLockAt != null && Date.now() >= universalLockAt;

        // This component owns only the current user's My Card indicators.
        // Group-card indicators are handled separately and must be keyed to
        // the actual player/pick status, never inferred from the current user.
        document.querySelectorAll<HTMLElement>(".visible-pick .lock-sync-indicator").forEach((icon) => icon.remove());
        document.querySelectorAll<HTMLElement>(".lock-sync-indicator").forEach((icon) => {
          if (universalLockReached) icon.remove();
        });
        if (universalLockReached) return;

        document.querySelectorAll<HTMLElement>(".pick-card").forEach((row) => {
          const displayedTeam = displayedTeamForRow(row);
          if (!displayedTeam) return;
          const lockedTeam = Array.from(lockedTeams).find((team) => teamMatches(team, displayedTeam));
          if (!lockedTeam) return;

          const actions = row.querySelector<HTMLElement>(".pick-row-actions");
          if (!actions) return;

          actions.querySelector<HTMLButtonElement>('button[aria-label^="Remove "]')?.style.setProperty("display", "none");
          actions.querySelector(".manual-pick-lock")?.remove();

          if (actions.querySelector(".pick-lock-indicator")) return;
          const icon = document.createElement("span");
          icon.className = "pick-lock-indicator lock-sync-indicator";
          icon.setAttribute("aria-label", "Locked");
          icon.innerHTML = lockIconMarkup();
          actions.prepend(icon);
        });
      } finally {
        applying = false;
      }
    };

    const syncedFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await originalFetch(input, init);
      try {
        const rawUrl = typeof input === "string" || input instanceof URL ? String(input) : input.url;
        const url = new URL(rawUrl, window.location.origin);
        if (url.pathname === "/api/picks/lock" && response.ok && typeof init?.body === "string") {
          const body = JSON.parse(init.body) as { selectedTeam?: string; week?: number };
          const responsePayload = await response.clone().json() as { pick?: { locked_spread?: number | null } };
          if (body.selectedTeam) {
            confirmedThisSession.add(body.selectedTeam);
            writeLockedStatusToCache(appSlug, body.selectedTeam, body.week ?? selectedWeekFromHeader(), responsePayload.pick?.locked_spread ?? null);
            schedule();
          }
        }
      } catch {
        // Never interfere with the underlying request if sync parsing fails.
      }
      return response;
    }) as typeof window.fetch;

    window.fetch = syncedFetch;
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    schedule();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.querySelectorAll(".lock-sync-indicator").forEach((icon) => icon.remove());
      if (window.fetch === syncedFetch) window.fetch = originalFetch;
    };
  }, [appSlug]);

  return null;
}
