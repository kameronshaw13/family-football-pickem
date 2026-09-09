"use client";

import { useEffect } from "react";
import { normalizeSpreadForSelectedTeam, spreadText } from "@/lib/spreads";
import { teamDisplayName } from "@/lib/teamNames";

type AppSlug = "shaw-family" | "other-family" | "friends";
type BatchSelection = { gameId: string; creatorTeam: string };
type CachedProfile = { id: string; display_name: string };
type CachedGame = {
  id: string;
  week: number;
  league: string;
  away_team: string;
  home_team: string;
  away_logo_url?: string | null;
  home_logo_url?: string | null;
  current_spread_team?: string | null;
  current_spread?: number | null;
};
type CachedPayload = {
  week?: number | null;
  currentUser?: CachedProfile | null;
  profiles?: CachedProfile[];
  games?: CachedGame[];
};

const APP_DATA_CACHE_PREFIX = "pickem_app_data_v1";
const MAX_BATCH_SELECTIONS = 4;

function appSlugFromPath(): AppSlug {
  if (window.location.pathname.startsWith("/friends")) return "friends";
  if (window.location.pathname.startsWith("/caleb-family")) return "other-family";
  return "shaw-family";
}

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
      if (!entry?.payload) continue;
      if (week != null && entry.payload.week != null && Number(entry.payload.week) !== week) continue;
      return entry.payload;
    } catch {
      // Ignore stale cache entries.
    }
  }
  return null;
}

function gameLabel(game: CachedGame) {
  return `${teamDisplayName(game.league, game.away_team)} at ${teamDisplayName(game.league, game.home_team)}`;
}

function gameForCard(card: HTMLElement, payload: CachedPayload | null) {
  const label = card.querySelector<HTMLElement>(".stacked-matchup")?.getAttribute("aria-label")?.trim();
  if (!label) return null;
  return payload?.games?.find((game) => gameLabel(game) === label) || null;
}

function rawTeamForRow(row: HTMLElement, game: CachedGame) {
  const displayed = row.querySelector<HTMLElement>(".responsive-text")?.getAttribute("aria-label")?.trim()
    || row.querySelector<HTMLElement>(".team-name")?.textContent?.trim()
    || "";
  if (displayed === teamDisplayName(game.league, game.away_team)) return game.away_team;
  if (displayed === teamDisplayName(game.league, game.home_team)) return game.home_team;
  return "";
}

function logoForTeam(game: CachedGame, team: string) {
  return team === game.home_team ? game.home_logo_url : game.away_logo_url;
}

function showBatchMessage(message: string, tone: "success" | "error" = "success") {
  document.querySelector(".batch-side-bet-toast")?.remove();
  const toast = document.createElement("div");
  toast.className = `batch-side-bet-toast ${tone}`;
  toast.setAttribute("role", tone === "error" ? "alert" : "status");
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3000);
}

function openOffersView() {
  const viewSelect = document.querySelector<HTMLElement>(".side-bet-filter-row .compact-select");
  const trigger = viewSelect?.querySelector<HTMLButtonElement>(".custom-select-trigger");
  if (!trigger || /^offers\b/i.test(trigger.textContent?.trim() || "")) return;
  trigger.click();
  window.requestAnimationFrame(() => {
    const option = Array.from(document.querySelectorAll<HTMLButtonElement>(".custom-select-option"))
      .find((candidate) => /^offers\b/i.test(candidate.textContent?.trim() || ""));
    option?.click();
  });
}

export default function SideBetBatchEnhancements() {
  useEffect(() => {
    const appSlug = appSlugFromPath();
    let selections: BatchSelection[] = [];
    let ledgerScope: "all" | "mine" = "all";
    let applying = false;
    let frame = 0;
    let sending = false;
    let suppressSelectionCapture = false;
    let pendingNativeSync = false;

    const selectionKey = (selection: BatchSelection) => `${selection.gameId}::${selection.creatorTeam}`;
    const sameSelection = (left: BatchSelection | null, right: BatchSelection | null) => Boolean(left && right && left.gameId === right.gameId && left.creatorTeam === right.creatorTeam);

    function currentNativeSelection(): BatchSelection | null {
      const row = document.querySelector<HTMLButtonElement>(".side-bet-game-card .team-row.picked-side");
      const card = row?.closest<HTMLElement>(".side-bet-game-card");
      const gameId = card?.dataset.batchGameId || "";
      const creatorTeam = row?.dataset.batchTeam || "";
      return gameId && creatorTeam ? { gameId, creatorTeam } : null;
    }

    function nativeSelectionIsCurrent() {
      const current = currentNativeSelection();
      return Boolean(current && selections.some((selection) => sameSelection(selection, current)));
    }

    function rowForSelection(selection: BatchSelection) {
      return Array.from(document.querySelectorAll<HTMLButtonElement>(".side-bet-game-card .team-row"))
        .find((row) => row.closest<HTMLElement>(".side-bet-game-card")?.dataset.batchGameId === selection.gameId && row.dataset.batchTeam === selection.creatorTeam) || null;
    }

    function syncNativeSelection() {
      const current = currentNativeSelection();
      if (!selections.length) {
        pendingNativeSync = false;
        if (current) {
          const currentRow = rowForSelection(current);
          if (currentRow) {
            suppressSelectionCapture = true;
            currentRow.click();
            suppressSelectionCapture = false;
          }
        }
        return;
      }

      if (current && selections.some((selection) => sameSelection(selection, current))) {
        pendingNativeSync = false;
        return;
      }

      const desired = selections[selections.length - 1];
      const desiredRow = rowForSelection(desired);
      if (!desiredRow) return;
      suppressSelectionCapture = true;
      desiredRow.click();
      suppressSelectionCapture = false;
      pendingNativeSync = false;
    }

    function annotateSideBetBoard(payload: CachedPayload | null) {
      document.querySelectorAll<HTMLElement>(".side-bet-game-card").forEach((card) => {
        const game = gameForCard(card, payload);
        if (!game) return;
        if (card.dataset.batchGameId !== game.id) card.dataset.batchGameId = game.id;
        card.querySelectorAll<HTMLElement>(".team-row").forEach((row) => {
          const team = rawTeamForRow(row, game);
          if (!team) return;
          if (row.dataset.batchTeam !== team) row.dataset.batchTeam = team;
          const selected = selections.some((selection) => selection.gameId === game.id && selection.creatorTeam === team);
          row.classList.toggle("batch-picked-side", selected);
        });
      });
    }

    function annotateRecipients(payload: CachedPayload | null) {
      const currentUserId = payload?.currentUser?.id;
      document.querySelectorAll<HTMLElement>(".side-bet-recipient-grid label").forEach((label) => {
        const name = label.querySelector<HTMLElement>("span")?.textContent?.trim() || "";
        const profile = payload?.profiles?.find((candidate) => candidate.id !== currentUserId && candidate.display_name === name);
        if (profile && label.dataset.batchRecipientId !== profile.id) label.dataset.batchRecipientId = profile.id;
      });
    }

    function applyLedgerScope() {
      const heading = Array.from(document.querySelectorAll<HTMLElement>(".bank-section .standings-heading-row h2"))
        .find((candidate) => candidate.textContent?.replace(/\s+/g, " ").trim().startsWith("Side Bet Ledger"));
      const headingRow = heading?.closest<HTMLElement>(".standings-heading-row");
      const section = heading?.closest<HTMLElement>(".bank-section");
      const list = section?.querySelector<HTMLElement>(".ledger-list");
      if (!heading || !headingRow || !list) return;

      let controls = headingRow.querySelector<HTMLElement>(".side-bet-ledger-scope");
      if (!controls) {
        controls = document.createElement("div");
        controls.className = "side-bet-ledger-scope compact-select";

        const select = document.createElement("select");
        select.setAttribute("aria-label", "Filter side bet ledger");
        const allOption = document.createElement("option");
        allOption.value = "all";
        allOption.textContent = "All";
        const mineOption = document.createElement("option");
        mineOption.value = "mine";
        mineOption.textContent = "My Bets";
        select.append(allOption, mineOption);
        select.value = ledgerScope;
        select.addEventListener("change", () => {
          ledgerScope = select.value === "mine" ? "mine" : "all";
          schedule();
        });
        controls.appendChild(select);

        const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        chevron.setAttribute("class", "side-bet-ledger-chevron");
        chevron.setAttribute("viewBox", "0 0 24 24");
        chevron.setAttribute("width", "15");
        chevron.setAttribute("height", "15");
        chevron.setAttribute("fill", "none");
        chevron.setAttribute("stroke", "currentColor");
        chevron.setAttribute("stroke-width", "2");
        chevron.setAttribute("stroke-linecap", "round");
        chevron.setAttribute("stroke-linejoin", "round");
        chevron.setAttribute("aria-hidden", "true");
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", "m6 9 6 6 6-6");
        chevron.appendChild(path);
        controls.appendChild(chevron);

        headingRow.appendChild(controls);
      }

      const scopeSelect = controls.querySelector<HTMLSelectElement>("select");
      if (scopeSelect && scopeSelect.value !== ledgerScope) scopeSelect.value = ledgerScope;

      const rows = Array.from(list.querySelectorAll<HTMLElement>(".side-bet-ledger-row"));
      let visibleMine = 0;
      rows.forEach((row) => {
        const isMine = /\bYou\b/.test(row.querySelector<HTMLElement>("p")?.textContent || "");
        row.classList.toggle("is-user-side-bet", isMine);
        const hidden = ledgerScope === "mine" && !isMine;
        row.classList.toggle("ledger-scope-hidden", hidden);
        if (isMine && !hidden) visibleMine += 1;
      });

      let empty = list.querySelector<HTMLElement>(".side-bet-ledger-filter-empty");
      const showEmpty = ledgerScope === "mine" && rows.length > 0 && visibleMine === 0;
      if (showEmpty && !empty) {
        empty = document.createElement("p");
        empty.className = "muted ledger-empty-state side-bet-ledger-filter-empty";
        empty.textContent = "No side bets involving you yet.";
        list.appendChild(empty);
      } else if (!showEmpty) {
        empty?.remove();
      }
    }

    function buildBatchList(sheet: HTMLElement, payload: CachedPayload | null) {
      const staleSingle = selections.length === 1 && !nativeSelectionIsCurrent();
      const needsBatchPresentation = selections.length > 1 || staleSingle;
      if (!needsBatchPresentation) {
        sheet.classList.remove("batch-mode");
        sheet.querySelector(".side-bet-batch-list")?.remove();
        return;
      }

      sheet.classList.add("batch-mode");
      let list = sheet.querySelector<HTMLElement>(".side-bet-batch-list");
      if (!list) {
        list = document.createElement("section");
        list.className = "side-bet-batch-list";
        sheet.querySelector(".side-bet-slip-sheet-head")?.insertAdjacentElement("afterend", list);
      }

      const signature = selections.map(selectionKey).join("|");
      if (list.dataset.signature === signature) return;
      list.dataset.signature = signature;
      list.replaceChildren();

      const head = document.createElement("div");
      head.className = "side-bet-slip-section-head side-bet-batch-head";
      const label = document.createElement("span");
      label.textContent = "Selected bets";
      const count = document.createElement("strong");
      count.textContent = String(selections.length);
      head.append(label, count);
      list.appendChild(head);

      selections.forEach((selection) => {
        const game = payload?.games?.find((candidate) => candidate.id === selection.gameId);
        if (!game) return;
        const row = document.createElement("div");
        row.className = "side-bet-batch-row";

        const logoUrl = logoForTeam(game, selection.creatorTeam);
        if (logoUrl) {
          const image = document.createElement("img");
          image.className = "team-logo";
          image.src = logoUrl;
          image.alt = "";
          image.width = 34;
          image.height = 34;
          row.appendChild(image);
        } else {
          const fallback = document.createElement("div");
          fallback.className = "team-logo fallback";
          fallback.textContent = selection.creatorTeam.slice(0, 1);
          row.appendChild(fallback);
        }

        const copy = document.createElement("div");
        copy.className = "side-bet-batch-copy";
        const team = document.createElement("strong");
        team.textContent = teamDisplayName(game.league, selection.creatorTeam);
        const spread = normalizeSpreadForSelectedTeam(selection.creatorTeam, game.current_spread_team, game.current_spread);
        const meta = document.createElement("span");
        meta.textContent = `${spreadText(spread)} · ${gameLabel(game)}`;
        copy.append(team, meta);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "side-bet-batch-remove";
        remove.setAttribute("aria-label", `Remove ${team.textContent}`);
        remove.textContent = "×";
        remove.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const nativeBefore = currentNativeSelection();
          const removedWasNative = sameSelection(nativeBefore, selection);
          selections = selections.filter((candidate) => selectionKey(candidate) !== selectionKey(selection));
          pendingNativeSync = removedWasNative && selections.length > 0;
          if (!selections.length) syncNativeSelection();
          schedule();
        });

        row.append(copy, remove);
        list!.appendChild(row);
      });
    }

    function applyBatchUi(payload: CachedPayload | null) {
      annotateSideBetBoard(payload);
      annotateRecipients(payload);
      applyLedgerScope();

      const staleSingle = selections.length === 1 && !nativeSelectionIsCurrent();
      const batchPresentationActive = selections.length > 1 || staleSingle;
      const boardVisible = Boolean(document.querySelector(".side-bet-sportsbook-board"));
      document.body.classList.toggle("side-bet-batch-active", boardVisible && batchPresentationActive);

      const bar = document.querySelector<HTMLElement>(".side-bet-slip-bar");
      if (bar) {
        if (selections.length > 1) bar.dataset.batchCount = String(selections.length);
        else delete bar.dataset.batchCount;
      }

      const sheet = document.querySelector<HTMLElement>(".side-bet-slip-sheet");
      if (sheet) buildBatchList(sheet, payload);

      if (pendingNativeSync && !sheet) {
        syncNativeSelection();
      }
    }

    async function sendBatch() {
      if (sending || selections.length < 1) return;
      const payload = readCachedPayload(appSlug);
      const token = window.localStorage.getItem("pickem_session_token");
      if (!payload || !token) {
        showBatchMessage("Could not read the current side bet selections. Try again.", "error");
        return;
      }

      const amountButton = document.querySelector<HTMLButtonElement>(".side-bet-amount-grid button.active");
      const amount = Number((amountButton?.textContent || "").replace(/[^0-9.]/g, ""));
      const recipientIds = Array.from(document.querySelectorAll<HTMLInputElement>(".side-bet-recipient-grid input:checked"))
        .map((input) => input.closest<HTMLElement>("label")?.dataset.batchRecipientId || "")
        .filter(Boolean);
      if (!amount || !recipientIds.length) {
        showBatchMessage("Choose an amount and at least one person to send the bets to.", "error");
        return;
      }

      const submit = document.querySelector<HTMLButtonElement>(".side-bet-slip-submit");
      const wasDisabled = Boolean(submit?.disabled);
      sending = true;
      if (submit) submit.disabled = true;
      try {
        const response = await fetch("/api/side-bets/batch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "x-pickem-group": appSlug
          },
          body: JSON.stringify({ selections, amount, recipientIds, viewWeek: payload.week ?? selectedWeekFromHeader() ?? undefined })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "The side bet batch could not be sent.");

        const sentCount = Number(result.createdCount || selections.length);
        selections = [];
        pendingNativeSync = false;
        syncNativeSelection();
        schedule();
        showBatchMessage(`${sentCount} side bet offer${sentCount === 1 ? "" : "s"} sent.`, "success");
        window.setTimeout(openOffersView, 120);
      } catch (error) {
        showBatchMessage(error instanceof Error ? error.message : "The side bet batch could not be sent.", "error");
      } finally {
        sending = false;
        if (submit) submit.disabled = wasDisabled;
      }
    }

    function schedule() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (applying) return;
        applying = true;
        try {
          applyBatchUi(readCachedPayload(appSlug));
        } finally {
          applying = false;
        }
      });
    }

    function onDocumentClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const submit = target.closest<HTMLButtonElement>(".side-bet-slip-submit");
      if (submit && (selections.length > 1 || (selections.length === 1 && !nativeSelectionIsCurrent()))) {
        event.preventDefault();
        event.stopPropagation();
        void sendBatch();
        return;
      }

      const row = target.closest<HTMLButtonElement>(".side-bet-game-card .team-row");
      if (!row || row.disabled || suppressSelectionCapture) return;
      const payload = readCachedPayload(appSlug);
      const card = row.closest<HTMLElement>(".side-bet-game-card");
      const game = card ? gameForCard(card, payload) : null;
      if (!game) return;
      const team = rawTeamForRow(row, game);
      if (!team) return;

      const clickedSelection = { gameId: game.id, creatorTeam: team };
      const nativeBefore = currentNativeSelection();
      const existingIndex = selections.findIndex((selection) => selection.gameId === game.id);
      if (existingIndex >= 0 && selections[existingIndex].creatorTeam === team) {
        selections = selections.filter((_, index) => index !== existingIndex);
        pendingNativeSync = sameSelection(nativeBefore, clickedSelection) && selections.length > 0;
      } else if (existingIndex >= 0) {
        selections = selections.map((selection, index) => index === existingIndex ? clickedSelection : selection);
        pendingNativeSync = false;
      } else {
        if (selections.length >= MAX_BATCH_SELECTIONS) {
          event.preventDefault();
          event.stopPropagation();
          showBatchMessage(`You can select up to ${MAX_BATCH_SELECTIONS} side bets at a time.`, "error");
          return;
        }
        selections = [...selections, clickedSelection];
        pendingNativeSync = false;
      }
      schedule();
      window.requestAnimationFrame(schedule);
    }

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onDocumentClick, true);
    schedule();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("click", onDocumentClick, true);
      document.body.classList.remove("side-bet-batch-active");
      document.querySelector(".batch-side-bet-toast")?.remove();
    };
  }, []);

  return null;
}
