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
type SelectionInfo = {
  game: CachedGame | null;
  matchup: string;
  dateTime: string;
  selectedTeam: string | null;
  selectedDisplay: string;
  selectedSpread: string;
  offeredDisplay: string;
  offeredSpread: string;
};

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

function selectionInfo(row: HTMLElement, payload: CachedPayload | null): SelectionInfo {
  const copy = row.querySelector<HTMLElement>(".side-bet-batch-copy, .side-bet-batch-native-choice");
  const team = copy?.querySelector<HTMLElement>("strong, .team-name") || null;
  const market = copy?.querySelector<HTMLElement>("span, .team-spread") || null;
  const rawMarket = market?.textContent || "";

  if (!row.dataset.batchSpread) row.dataset.batchSpread = spreadOnly(rawMarket);
  if (!row.dataset.batchMatchup) row.dataset.batchMatchup = matchupOnly(rawMarket);

  const matchup = row.dataset.batchMatchup || "";
  const game = payload?.games?.find((candidate) => gameLabel(candidate) === matchup) || null;
  const selectedDisplay = team?.textContent?.trim() || "";
  const selectedTeam = game
    ? [game.away_team, game.home_team].find((candidate) => teamDisplayName(game.league, candidate) === selectedDisplay) || null
    : null;
  const creatorSpread = game && selectedTeam
    ? normalizeSpreadForSelectedTeam(selectedTeam, game.current_spread_team, game.current_spread)
    : null;
  const offeredTeam = game && selectedTeam
    ? (selectedTeam === game.home_team ? game.away_team : game.home_team)
    : null;

  return {
    game,
    matchup,
    dateTime: game ? gameDateTime(game) : "",
    selectedTeam,
    selectedDisplay,
    selectedSpread: row.dataset.batchSpread || spreadText(creatorSpread),
    offeredDisplay: game && offeredTeam ? teamDisplayName(game.league, offeredTeam) : "",
    offeredSpread: creatorSpread == null ? "" : spreadText(-creatorSpread)
  };
}

function updateHeader(sheet: HTMLElement, infos: SelectionInfo[]) {
  const title = sheet.querySelector<HTMLElement>(".side-bet-slip-title");
  if (!title) return;
  let lines = title.querySelector<HTMLElement>(".side-bet-batch-header-lines");
  if (!lines) {
    lines = document.createElement("div");
    lines.className = "side-bet-batch-header-lines";
    title.appendChild(lines);
  }
  lines.replaceChildren();
  infos.forEach((info) => {
    const line = document.createElement("div");
    line.className = "side-bet-batch-header-line";
    line.textContent = [info.matchup, info.dateTime].filter(Boolean).join(" · ");
    lines!.appendChild(line);
  });
}

function updateSummary(sheet: HTMLElement, infos: SelectionInfo[]) {
  const summary = sheet.querySelector<HTMLElement>(":scope > .side-bet-slip-summary");
  if (!summary) return;
  const sections = Array.from(summary.children).filter((node): node is HTMLElement => node instanceof HTMLElement);
  if (sections.length < 2) return;

  const keepText = infos
    .map((info) => `${info.selectedDisplay} ${info.selectedSpread}`.trim())
    .filter(Boolean)
    .join(" · ");
  const getText = infos
    .map((info) => `${info.offeredDisplay} ${info.offeredSpread}`.trim())
    .filter(Boolean)
    .join(" · ");

  [keepText, getText].forEach((text, index) => {
    let value = sections[index].querySelector<HTMLElement>(".side-bet-batch-summary-value");
    if (!value) {
      value = document.createElement("strong");
      value.className = "side-bet-batch-summary-value";
      sections[index].appendChild(value);
    }
    value.textContent = text;
  });
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
      document.querySelectorAll(".side-bet-batch-game-meta, .side-bet-batch-terms").forEach((node) => node.remove());

      const rows = Array.from(document.querySelectorAll<HTMLElement>(".side-bet-batch-row"));
      const infos: SelectionInfo[] = [];
      rows.forEach((row) => {
        const copy = row.querySelector<HTMLElement>(".side-bet-batch-copy, .side-bet-batch-native-choice");
        if (!copy) return;
        const info = selectionInfo(row, payload);
        infos.push(info);

        if (!row.classList.contains("side-bet-batch-native-row")) {
          row.classList.add("team-row", "side-bet-slip-selection", "side-bet-batch-native-row");
        }
        if (!copy.classList.contains("side-bet-batch-native-choice")) {
          copy.className = "side-bet-slip-team-choice side-bet-batch-native-choice";
        }

        const team = copy.querySelector<HTMLElement>("strong, .team-name");
        const market = copy.querySelector<HTMLElement>("span, .team-spread");
        if (team && !team.classList.contains("team-name")) team.classList.add("team-name");
        if (market) {
          const nextText = row.dataset.batchSpread || spreadOnly(market.textContent || "");
          if (market.textContent !== nextText) market.textContent = nextText;
          if (!market.classList.contains("team-spread")) market.classList.add("team-spread");
        }
        ensureNativeRemoveButton(row);
      });

      const sheet = document.querySelector<HTMLElement>(".side-bet-slip-sheet.batch-mode");
      if (sheet && infos.length > 1) {
        updateHeader(sheet, infos);
        updateSummary(sheet, infos);
      }

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

    function clearStaleNativeSelection(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const remove = target.closest<HTMLButtonElement>(".side-bet-batch-remove");
      if (!remove) return;
      const sheet = remove.closest<HTMLElement>(".side-bet-slip-sheet");
      const nativeClear = sheet?.querySelector<HTMLButtonElement>(":scope > .side-bet-slip-selection .side-bet-selection-clear:not(.side-bet-batch-remove)");
      nativeClear?.click();
    }

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-batch-count"] });
    window.addEventListener("click", enforceFourGameLimit, true);
    window.addEventListener("click", clearStaleNativeSelection, true);
    schedule();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("click", enforceFourGameLimit, true);
      window.removeEventListener("click", clearStaleNativeSelection, true);
    };
  }, []);

  return null;
}
