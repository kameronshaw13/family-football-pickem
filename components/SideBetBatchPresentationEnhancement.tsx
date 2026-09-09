"use client";

import { useEffect } from "react";
import { normalizeSpreadForSelectedTeam, spreadText } from "@/lib/spreads";
import { teamDisplayName } from "@/lib/teamNames";

type AppSlug = "shaw-family" | "other-family" | "friends";
type CachedGame = {
  id: string;
  league: string;
  away_team: string;
  home_team: string;
  commence_time?: string | null;
  current_spread_team?: string | null;
  current_spread?: number | null;
};
type CachedPayload = { games?: CachedGame[] };

const APP_DATA_CACHE_PREFIX = "pickem_app_data_v1";
const CENTRAL_DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "America/Chicago"
});
const CENTRAL_TIME = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Chicago"
});

function appSlugFromPath(): AppSlug {
  if (window.location.pathname.startsWith("/friends")) return "friends";
  if (window.location.pathname.startsWith("/caleb-family")) return "other-family";
  return "shaw-family";
}

function selectedWeekFromHeader() {
  const text = document.querySelector<HTMLElement>(".scoreboard-header .week-select-wrap .custom-select-trigger")?.textContent || "";
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
      if (entry?.payload) return entry.payload;
    } catch {
      // Ignore stale cache entries.
    }
  }
  return null;
}

function gameLabel(game: CachedGame) {
  return `${teamDisplayName(game.league, game.away_team)} at ${teamDisplayName(game.league, game.home_team)}`;
}

function spreadOnly(value: string) {
  return value.split("·")[0]?.trim() || value.trim();
}

function matchupOnly(value: string) {
  return value.split("·").slice(1).join("·").trim();
}

function gameDateTime(game: CachedGame) {
  if (!game.commence_time) return "";
  const date = new Date(game.commence_time);
  if (Number.isNaN(date.getTime())) return "";
  return `${CENTRAL_DATE.format(date)} · ${CENTRAL_TIME.format(date)}`;
}

function ensureNativeRemoveButton(row: HTMLElement) {
  const remove = row.querySelector<HTMLButtonElement>(".side-bet-batch-remove");
  if (!remove) return;

  remove.className = "slip-icon-btn side-bet-selection-clear side-bet-batch-remove";
  if (remove.querySelector("svg")) return;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");

  const first = document.createElementNS("http://www.w3.org/2000/svg", "path");
  first.setAttribute("d", "M18 6 6 18");
  const second = document.createElementNS("http://www.w3.org/2000/svg", "path");
  second.setAttribute("d", "m6 6 12 12");
  svg.append(first, second);
  remove.replaceChildren(svg);
}

function ensureGameMeta(row: HTMLElement, game: CachedGame | null, matchup: string) {
  let meta = row.previousElementSibling instanceof HTMLElement && row.previousElementSibling.classList.contains("side-bet-batch-game-meta")
    ? row.previousElementSibling
    : null;
  if (!meta) {
    meta = document.createElement("div");
    meta.className = "side-bet-batch-game-meta";
    row.insertAdjacentElement("beforebegin", meta);
  }
  const dateTime = game ? gameDateTime(game) : "";
  meta.textContent = [matchup, dateTime].filter(Boolean).join(" · ");
}

function ensureTerms(row: HTMLElement, game: CachedGame | null, selectedTeam: string | null) {
  let terms = row.nextElementSibling instanceof HTMLElement && row.nextElementSibling.classList.contains("side-bet-batch-terms")
    ? row.nextElementSibling
    : null;
  if (!terms) {
    terms = document.createElement("div");
    terms.className = "side-bet-batch-terms";
    row.insertAdjacentElement("afterend", terms);
  }

  if (!game || !selectedTeam) {
    terms.textContent = "";
    return;
  }
  const offeredTeam = selectedTeam === game.home_team ? game.away_team : game.home_team;
  const creatorSpread = normalizeSpreadForSelectedTeam(selectedTeam, game.current_spread_team, game.current_spread);
  terms.textContent = `You get ${teamDisplayName(game.league, selectedTeam)} ${spreadText(creatorSpread)} · They keep ${teamDisplayName(game.league, offeredTeam)} ${spreadText(creatorSpread == null ? null : -creatorSpread)}`;
}

function showBatchLimitError() {
  document.querySelector(".batch-side-bet-toast")?.remove();
  const toast = document.createElement("div");
  toast.className = "batch-side-bet-toast error";
  toast.setAttribute("role", "alert");
  toast.textContent = "You can select up to 4 side bets at a time.";
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3000);
}

export default function SideBetBatchPresentationEnhancement() {
  useEffect(() => {
    const appSlug = appSlugFromPath();
    let frame = 0;
    let applying = false;

    function applyPresentation() {
      const payload = readCachedPayload(appSlug);
      document.querySelectorAll<HTMLElement>(".side-bet-batch-row").forEach((row) => {
        const copy = row.querySelector<HTMLElement>(".side-bet-batch-copy, .side-bet-batch-native-choice");
        if (!copy) return;

        const team = copy.querySelector<HTMLElement>("strong, .team-name");
        const market = copy.querySelector<HTMLElement>("span, .team-spread");
        const rawMarket = market?.textContent || "";
        if (!row.dataset.batchSpread) row.dataset.batchSpread = spreadOnly(rawMarket);
        if (!row.dataset.batchMatchup) row.dataset.batchMatchup = matchupOnly(rawMarket);
        const matchup = row.dataset.batchMatchup || "";
        const game = payload?.games?.find((candidate) => gameLabel(candidate) === matchup) || null;
        const selectedDisplay = team?.textContent?.trim() || "";
        const selectedTeam = game
          ? [game.away_team, game.home_team].find((candidate) => teamDisplayName(game.league, candidate) === selectedDisplay) || null
          : null;

        ensureGameMeta(row, game, matchup);

        if (!row.classList.contains("side-bet-batch-native-row")) {
          row.classList.add("team-row", "side-bet-slip-selection", "side-bet-batch-native-row");
        }
        if (!copy.classList.contains("side-bet-batch-native-choice")) {
          copy.className = "side-bet-slip-team-choice side-bet-batch-native-choice";
        }
        if (team && !team.classList.contains("team-name")) team.classList.add("team-name");
        if (market) {
          const nextText = row.dataset.batchSpread || spreadOnly(rawMarket);
          if (market.textContent !== nextText) market.textContent = nextText;
          if (!market.classList.contains("team-spread")) market.classList.add("team-spread");
        }

        ensureNativeRemoveButton(row);
        ensureTerms(row, game, selectedTeam);
      });

      document.querySelectorAll<HTMLElement>(".side-bet-slip-bar[data-batch-count]").forEach((bar) => {
        const total = Number(bar.dataset.batchCount || 0);
        const more = total > 1 ? String(total - 1) : "";
        if (more) {
          if (bar.dataset.batchMore !== more) bar.dataset.batchMore = more;
        } else {
          delete bar.dataset.batchMore;
        }
      });
    }

    function schedule() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (applying) return;
        applying = true;
        try {
          applyPresentation();
        } finally {
          applying = false;
        }
      });
    }

    function enforceFourGameLimit(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const row = target.closest<HTMLElement>(".side-bet-game-card .team-row");
      if (!row || row.getAttribute("disabled") != null) return;
      const card = row.closest<HTMLElement>(".side-bet-game-card");
      if (!card) return;
      const cardAlreadySelected = Boolean(card.querySelector(".team-row.batch-picked-side"));
      if (cardAlreadySelected) return;
      const selectedCount = document.querySelectorAll(".side-bet-game-card .team-row.batch-picked-side").length;
      if (selectedCount < 4) return;
      event.preventDefault();
      event.stopPropagation();
      showBatchLimitError();
    }

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-batch-count"] });
    window.addEventListener("click", enforceFourGameLimit, true);
    schedule();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("click", enforceFourGameLimit, true);
    };
  }, []);

  return null;
}
