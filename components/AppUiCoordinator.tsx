"use client";

import { useEffect } from "react";

type UiGame = {
  away_logo_url?: string | null;
  home_logo_url?: string | null;
};

type UiPayload = {
  games?: UiGame[];
};

type CacheEntry = { cachedAt?: number; payload?: UiPayload };

const CACHE_PREFIX = "pickem_app_data_v1:";
const preloadImages = new Map<string, HTMLImageElement>();

function cachedPayload() {
  let best: { cachedAt: number; payload: UiPayload } | null = null;
  try {
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (!key?.startsWith(CACHE_PREFIX)) continue;
      const entry = JSON.parse(window.sessionStorage.getItem(key) || "null") as CacheEntry | null;
      if (!entry?.payload) continue;
      const cachedAt = Number(entry.cachedAt || 0);
      if (!best || cachedAt > best.cachedAt) best = { cachedAt, payload: entry.payload };
    }
  } catch {
    return null;
  }
  return best?.payload || null;
}

function makeSeasonNamesInteractive() {
  const heading = Array.from(document.querySelectorAll<HTMLElement>(".standings-panel .scoreboard-heading h2"))
    .find((node) => node.textContent?.trim() === "Season Standings");
  const leaderboard = heading?.closest(".scoreboard-heading")?.nextElementSibling;
  if (!(leaderboard instanceof HTMLElement) || !leaderboard.classList.contains("leaderboard")) return;
  leaderboard.querySelectorAll<HTMLElement>(".leaderboard-player strong").forEach((name) => {
    name.classList.add("player-profile-link");
    name.dataset.playerProfileName = name.textContent?.trim() || "";
    name.setAttribute("role", "button");
    name.setAttribute("tabindex", "0");
    name.setAttribute("aria-label", `Open ${name.dataset.playerProfileName || "player"} profile`);
  });
}

function preloadLogos(payload: UiPayload | null) {
  for (const game of payload?.games || []) {
    for (const url of [game.away_logo_url, game.home_logo_url]) {
      if (!url || preloadImages.has(url)) continue;
      const image = new Image();
      image.src = url;
      preloadImages.set(url, image);
      void image.decode?.().catch(() => undefined);
    }
  }
}

export default function AppUiCoordinator() {
  useEffect(() => {
    let active = true;
    let frame = 0;

    function run() {
      if (!active) return;
      makeSeasonNamesInteractive();
      preloadLogos(cachedPayload());
    }

    function schedule() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(run);
    }

    function onKey(event: KeyboardEvent) {
      if (!["Enter", " "].includes(event.key)) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.classList.contains("player-profile-link")) target.click();
    }

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("keydown", onKey);
    window.addEventListener("focus", schedule);
    schedule();

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("focus", schedule);
    };
  }, []);
  return null;
}
