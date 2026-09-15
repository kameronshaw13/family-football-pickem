"use client";

import { useEffect } from "react";
import type { AppSlug } from "@/lib/rulePresentation";

const APP_DATA_CACHE_PREFIX = "pickem_app_data_v1";
const FRIEND_DISPLAY_AMOUNTS = [40, 30, 20, 10] as const;
const FRIEND_REQUEST_AMOUNT_MAP: Record<string, number> = {
  "20": 40,
  "15": 30,
  "10": 20,
  "5": 10
};

type CachedGame = {
  lock_time?: string | null;
  commence_time?: string | null;
};

type CachedPayload = {
  week?: number | null;
  games?: CachedGame[];
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

  for (const key of preferredKeys) {
    try {
      const raw = window.sessionStorage.getItem(key);
      if (!raw) continue;
      const entry = JSON.parse(raw) as { payload?: CachedPayload } | null;
      if (!entry?.payload) continue;
      if (week != null && entry.payload.week != null && Number(entry.payload.week) !== week) continue;
      return entry.payload;
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

  // Use the lock time shared by the most weekend games instead of the earliest
  // timestamp. One stale game row should never make the entire week's UI look
  // universally locked.
  const counts = new Map<number, number>();
  for (const value of candidates) counts.set(value, (counts.get(value) || 0) + 1);
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || right[0] - left[0])[0]?.[0] ?? null;
}

function lockIconMarkup() {
  return `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
}

function restoreLockedPickIcons(appSlug: AppSlug) {
  const payload = readCachedPayload(appSlug);
  const universalLockAt = universalWeekendLockTime(payload?.games || []);
  const universalLockReached = universalLockAt != null && Date.now() >= universalLockAt;

  document.querySelectorAll<HTMLElement>(".ui-correction-lock-icon").forEach((icon) => {
    if (universalLockReached) icon.remove();
  });
  if (universalLockReached) return;

  const selectors = [
    ".pick-card .pick-row-actions",
    ".visible-pick .visible-pick-actions"
  ];
  document.querySelectorAll<HTMLElement>(selectors.join(",")).forEach((actions) => {
    if (actions.querySelector(".pick-lock-indicator, .ui-correction-lock-icon")) return;
    if (actions.querySelector('button[aria-label^="Remove "]')) return;
    if (actions.querySelector(".badge, .test-result, .score-bug")) return;

    const row = actions.closest<HTMLElement>(".pick-card, .visible-pick");
    if (!row) return;
    const text = row.textContent || "";
    if (/\b(?:Final|Live)\b/i.test(text)) return;

    // A pending pick with no remove control is server-locked. Restore the icon
    // until the normal universal Saturday lock, when all right-side icons hide.
    const icon = document.createElement("span");
    icon.className = "pick-lock-indicator ui-correction-lock-icon";
    icon.setAttribute("aria-label", "Locked");
    icon.innerHTML = lockIconMarkup();
    actions.prepend(icon);
  });
}

function applyFriendsAmountLabels() {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".side-bet-amount-grid button"));
  if (buttons.length !== FRIEND_DISPLAY_AMOUNTS.length) return;
  buttons.forEach((button, index) => {
    const amount = FRIEND_DISPLAY_AMOUNTS[index];
    button.dataset.friendsAmount = String(amount);
    const token = button.querySelector<HTMLElement>(".numeric-token");
    if (token && token.textContent !== `$${amount}`) token.textContent = `$${amount}`;
  });
}

function patchedFriendsFetch(originalFetch: typeof window.fetch) {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const rawUrl = typeof input === "string" || input instanceof URL ? String(input) : input.url;
      const url = new URL(rawUrl, window.location.origin);
      if (url.pathname === "/api/side-bets" && typeof init?.body === "string") {
        const body = JSON.parse(init.body) as { action?: string; amount?: number };
        const mapped = body.action === "create" ? FRIEND_REQUEST_AMOUNT_MAP[String(body.amount)] : undefined;
        if (mapped != null) {
          init = { ...init, body: JSON.stringify({ ...body, amount: mapped }) };
        }
      }
    } catch {
      // If a request is not JSON or is unrelated, leave it untouched.
    }
    return originalFetch(input, init);
  }) as typeof window.fetch;
}

export default function PickemUiCorrections({ appSlug }: { appSlug: AppSlug }) {
  useEffect(() => {
    let frame = 0;
    let applying = false;
    const originalFetch = window.fetch;
    const friendsFetch = appSlug === "friends" ? patchedFriendsFetch(originalFetch.bind(window)) : null;
    if (friendsFetch) window.fetch = friendsFetch;

    const apply = () => {
      frame = 0;
      if (applying) return;
      applying = true;
      try {
        restoreLockedPickIcons(appSlug);
        if (appSlug === "friends") applyFriendsAmountLabels();
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
      document.querySelectorAll(".ui-correction-lock-icon").forEach((icon) => icon.remove());
      if (friendsFetch && window.fetch === friendsFetch) window.fetch = originalFetch;
    };
  }, [appSlug]);

  return null;
}
