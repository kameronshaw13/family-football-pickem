"use client";

import { useEffect } from "react";
import type { AppSlug } from "@/lib/rulePresentation";

const APP_DATA_CACHE_PREFIX = "pickem_app_data_v1";

type CachedGame = {
  lock_time?: string | null;
  commence_time?: string | null;
};

type CachedProfile = {
  id?: string | null;
  display_name?: string | null;
};

type CachedPick = {
  user_id?: string | null;
  week?: number | null;
  selected_team?: string | null;
  status?: string | null;
};

type CachedPayload = {
  week?: number | null;
  profiles?: CachedProfile[];
  games?: CachedGame[];
  picks?: CachedPick[];
};

function selectedWeekFromHeader() {
  const text = document.querySelector<HTMLElement>(".week-select-wrap .custom-select-trigger")?.textContent || "";
  const match = text.match(/Week\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function readCachedPayload(appSlug: AppSlug): CachedPayload | null {
  const week = selectedWeekFromHeader();
  const preferredKeys = [
    `${APP_DATA_CACHE_PREFIX}:${appSlug}:${week == null ? "default" : week}`,
    `${APP_DATA_CACHE_PREFIX}:${appSlug}:default`
  ];
  const discoveredKeys: string[] = [];
  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (key?.startsWith(`${APP_DATA_CACHE_PREFIX}:${appSlug}:`) && !preferredKeys.includes(key)) discoveredKeys.push(key);
  }

  for (const key of [...preferredKeys, ...discoveredKeys]) {
    try {
      const raw = window.sessionStorage.getItem(key);
      if (!raw) continue;
      const entry = JSON.parse(raw) as { payload?: CachedPayload } | null;
      const payload = entry?.payload;
      if (!payload) continue;
      if (week != null && payload.week != null && Number(payload.week) !== week) continue;
      return payload;
    } catch {
      // Ignore stale cache entries.
    }
  }
  return null;
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

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matches(left: string, right: string) {
  const a = normalize(left);
  const b = normalize(right);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

function displayedTeam(row: HTMLElement) {
  const responsive = row.querySelector<HTMLElement>(".pick-title-team .responsive-text");
  const direct = row.querySelector<HTMLElement>(".pick-title-team");
  return (responsive?.getAttribute("aria-label") || direct?.getAttribute("aria-label") || direct?.textContent || "").trim();
}

function lockIconMarkup() {
  return `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
}

export default function GroupLockedPickIconSync({ appSlug }: { appSlug: AppSlug }) {
  useEffect(() => {
    let frame = 0;
    let applying = false;

    const apply = () => {
      frame = 0;
      if (applying) return;
      applying = true;
      try {
        const payload = readCachedPayload(appSlug);
        const selectedWeek = selectedWeekFromHeader();
        const universalLockAt = universalWeekendLockTime(payload?.games || []);
        const universalLockReached = universalLockAt != null && Date.now() >= universalLockAt;

        document.querySelectorAll<HTMLElement>(".group-lock-sync-indicator").forEach((icon) => {
          if (universalLockReached) icon.remove();
        });
        if (universalLockReached || !payload) return;

        document.querySelectorAll<HTMLElement>(".group-card").forEach((card) => {
          const profileName = card.querySelector<HTMLElement>(":scope > h3")?.textContent?.trim() || "";
          const profile = payload.profiles?.find((candidate) => candidate.display_name?.trim() === profileName);
          if (!profile?.id) return;

          const lockedPicks = (payload.picks || []).filter((pick) => {
            const sameWeek = selectedWeek == null || pick.week == null || Number(pick.week) === selectedWeek;
            return pick.user_id === profile.id && sameWeek && pick.status === "locked" && Boolean(pick.selected_team);
          });

          card.querySelectorAll<HTMLElement>(".visible-pick").forEach((row) => {
            const team = displayedTeam(row);
            const isLocked = lockedPicks.some((pick) => pick.selected_team && matches(pick.selected_team, team));
            const actions = row.querySelector<HTMLElement>(".visible-pick-actions");
            if (!actions) return;

            const syncedIcon = actions.querySelector<HTMLElement>(".group-lock-sync-indicator");
            if (!isLocked) {
              syncedIcon?.remove();
              return;
            }
            if (actions.querySelector(".pick-lock-indicator")) return;

            const icon = document.createElement("span");
            icon.className = "pick-lock-indicator group-lock-sync-indicator";
            icon.setAttribute("aria-label", "Locked");
            icon.innerHTML = lockIconMarkup();
            actions.prepend(icon);
          });
        });
      } finally {
        applying = false;
      }
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(apply);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    schedule();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.querySelectorAll(".group-lock-sync-indicator").forEach((icon) => icon.remove());
    };
  }, [appSlug]);

  return null;
}
