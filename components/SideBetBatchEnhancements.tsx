"use client";

import { useEffect } from "react";
import { normalizeSpreadForSelectedTeam, spreadText } from "@/lib/spreads";
import { validAmericanOdds } from "@/lib/sideBetMarkets";
import { teamDisplayName } from "@/lib/teamNames";

type AppSlug = "shaw-family" | "other-family" | "friends";
type BatchMarketType = "spread" | "moneyline";
type BatchSelection = {
  gameId: string;
  creatorTeam: string;
  amount?: number | null;
  marketType?: BatchMarketType;
  creatorOdds?: number | null;
  creatorSpread?: number | null;
  recipientIds?: string[];
  recipientAll?: boolean;
  configured?: boolean;
};
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

const APP_DATA_CACHE_PREFIX = "pickem_app_data_v2";
const MAX_BATCH_SELECTIONS = 8;

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
    let suppressFormCapture = false;

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

    function initialTicket(game: CachedGame, creatorTeam: string): BatchSelection {
      return {
        gameId: game.id,
        creatorTeam,
        amount: 20,
        marketType: "spread",
        creatorOdds: 100,
        creatorSpread: normalizeSpreadForSelectedTeam(creatorTeam, game.current_spread_team, game.current_spread),
        recipientIds: [],
        recipientAll: false,
        configured: false
      };
    }

    function ticketIsComplete(selection: BatchSelection) {
      const amount = Number(selection.amount);
      const odds = Number(selection.creatorOdds);
      const recipients = selection.recipientIds || [];
      const spreadOk = selection.marketType === "moneyline" || Number.isFinite(Number(selection.creatorSpread));
      return Number.isFinite(amount) && amount > 0 && validAmericanOdds(odds) && recipients.length > 0 && spreadOk;
    }

    function nativeAmount() {
      const amountButton = document.querySelector<HTMLButtonElement>(".side-bet-amount-grid button.active");
      const riskInput = document.querySelector<HTMLInputElement>(".side-bet-risk-input");
      const raw = riskInput?.value || (amountButton?.textContent || "").replace(/[^0-9.]/g, "");
      const amount = Number(raw);
      return Number.isFinite(amount) && amount > 0 ? amount : null;
    }

    function nativeRecipients() {
      return Array.from(document.querySelectorAll<HTMLInputElement>(".side-bet-recipient-grid input:checked"))
        .map((input) => input.closest<HTMLElement>("label")?.dataset.batchRecipientId || "")
        .filter(Boolean);
    }

    function nativeAllRecipientsSelected() {
      return Boolean(document.querySelector<HTMLInputElement>('.side-bet-recipient-grid input[aria-label="All recipients"]')?.checked);
    }

    function recipientSummary(selection: BatchSelection, payload: CachedPayload | null) {
      if (selection.recipientAll) return "All";
      const names = (selection.recipientIds || [])
        .map((id) => payload?.profiles?.find((profile) => profile.id === id)?.display_name)
        .filter((name): name is string => Boolean(name));
      if (names.length <= 2) return names.join(", ");
      return `${names.slice(0, 2).join(", ")} +${names.length - 2} More`;
    }

    function readNativeTicket(selection: BatchSelection, payload: CachedPayload | null): BatchSelection {
      const marketButton = Array.from(document.querySelectorAll<HTMLButtonElement>(".side-bet-market-toggle button"))
        .find((button) => button.classList.contains("active"));
      const marketType: BatchMarketType = /moneyline/i.test(marketButton?.textContent || "") ? "moneyline" : "spread";
      const oddsValue = Number(document.querySelector<HTMLInputElement>(".side-bet-odds-input")?.value || 100);
      const spreadInput = document.querySelector<HTMLInputElement>(".side-bet-spread-input");
      const spreadValue = spreadInput?.value?.trim() === "" ? null : Number(spreadInput?.value);
      const game = payload?.games?.find((candidate) => candidate.id === selection.gameId);
      const fallbackSpread = game
        ? normalizeSpreadForSelectedTeam(selection.creatorTeam, game.current_spread_team, game.current_spread)
        : null;
      const next: BatchSelection = {
        ...selection,
        amount: nativeAmount(),
        marketType,
        creatorOdds: Number.isFinite(oddsValue) ? oddsValue : null,
        creatorSpread: marketType === "moneyline"
          ? 0
          : Number.isFinite(Number(spreadValue)) ? Number(spreadValue) : fallbackSpread,
        recipientIds: nativeRecipients(),
        recipientAll: nativeAllRecipientsSelected()
      };
      return { ...next, configured: ticketIsComplete(next) };
    }

    function captureCurrentTicket() {
      if (suppressFormCapture) return;
      const current = currentNativeSelection();
      if (!current) return;
      const index = selections.findIndex((selection) => sameSelection(selection, current));
      if (index < 0) return;
      const payload = readCachedPayload(appSlug);
      selections = selections.map((selection, selectionIndex) =>
        selectionIndex === index ? readNativeTicket(selection, payload) : selection
      );
    }

    function setInputValue(input: HTMLInputElement, value: string) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function applyTicketToNative(selection: BatchSelection) {
      suppressFormCapture = true;
      const desiredMarket = selection.marketType || "spread";
      const marketButton = Array.from(document.querySelectorAll<HTMLButtonElement>(".side-bet-market-toggle button"))
        .find((button) => desiredMarket === "moneyline"
          ? /moneyline/i.test(button.textContent || "")
          : /^spread$/i.test((button.textContent || "").trim()));
      if (marketButton && !marketButton.classList.contains("active")) marketButton.click();

      window.requestAnimationFrame(() => {
        const spreadInput = document.querySelector<HTMLInputElement>(".side-bet-spread-input");
        if (desiredMarket === "spread" && spreadInput && Number.isFinite(Number(selection.creatorSpread))) {
          setInputValue(spreadInput, String(selection.creatorSpread));
        }
        const oddsInput = document.querySelector<HTMLInputElement>(".side-bet-odds-input");
        if (oddsInput && Number.isFinite(Number(selection.creatorOdds))) {
          setInputValue(oddsInput, String(selection.creatorOdds));
        }

        const desiredAmount = Number(selection.amount);
        const amountButton = Array.from(document.querySelectorAll<HTMLButtonElement>(".side-bet-amount-grid button"))
          .find((button) => Number((button.textContent || "").replace(/[^0-9.]/g, "")) === desiredAmount);
        if (amountButton) amountButton.click();
        else {
          const riskInput = document.querySelector<HTMLInputElement>(".side-bet-risk-input");
          if (riskInput && Number.isFinite(desiredAmount) && desiredAmount > 0) setInputValue(riskInput, String(desiredAmount));
        }

        const allInput = document.querySelector<HTMLInputElement>('.side-bet-recipient-grid input[aria-label="All recipients"]');
        if (allInput?.checked) allInput.click();
        if (selection.recipientAll && allInput && !allInput.disabled) {
          allInput.click();
        } else {
          const desiredRecipients = new Set(selection.recipientIds || []);
          document.querySelectorAll<HTMLInputElement>(".side-bet-recipient-grid input").forEach((input) => {
            const recipientId = input.closest<HTMLElement>("label")?.dataset.batchRecipientId;
            if (!recipientId) return;
            const shouldBeChecked = desiredRecipients.has(recipientId);
            if (input.checked !== shouldBeChecked) input.click();
          });
        }

        window.requestAnimationFrame(() => {
          suppressFormCapture = false;
          captureCurrentTicket();
          schedule();
        });
      });
    }

    function activateTicket(selection: BatchSelection) {
      captureCurrentTicket();
      const current = currentNativeSelection();
      const row = rowForSelection(selection);
      if (row && !sameSelection(current, selection)) {
        suppressSelectionCapture = true;
        row.click();
        suppressSelectionCapture = false;
      }
      window.requestAnimationFrame(() => {
        annotateRecipients(readCachedPayload(appSlug));
        applyTicketToNative(selection);
      });
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

      const active = currentNativeSelection();
      const signature = selections.map((selection) => [
        selectionKey(selection),
        selection.marketType || "spread",
        selection.creatorSpread ?? "",
        selection.creatorOdds ?? "",
        selection.amount ?? "",
        (selection.recipientIds || []).join(","),
        selection.recipientAll ? "all" : "some",
        selection.configured ? "ready" : "open",
        sameSelection(active, selection) ? "active" : ""
      ].join("::")).join("|");
      if (list.dataset.signature === signature) return;
      list.dataset.signature = signature;
      list.replaceChildren();

      selections.forEach((selection) => {
        const game = payload?.games?.find((candidate) => candidate.id === selection.gameId);
        if (!game) return;

        const row = document.createElement("div");
        row.className = `side-bet-batch-row side-bet-batch-ticket-row${sameSelection(active, selection) ? " active-ticket" : ""}`;
        row.dataset.batchMatchup = gameLabel(game);
        row.dataset.batchMarketType = selection.marketType || "spread";
        row.dataset.batchCreatorOdds = String(selection.creatorOdds ?? 100);
        if (Number.isFinite(Number(selection.creatorSpread))) {
          row.dataset.batchSpread = spreadText(Number(selection.creatorSpread));
          row.dataset.batchSpreadValue = String(selection.creatorSpread);
        }
        row.addEventListener("click", (event) => {
          if ((event.target as Element).closest(".side-bet-batch-remove")) return;
          event.preventDefault();
          event.stopPropagation();
          activateTicket(selection);
        });

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
        const choice = document.createElement("div");
        choice.className = "side-bet-batch-ticket-choice";
        const team = document.createElement("strong");
        team.className = "team-name";
        team.textContent = teamDisplayName(game.league, selection.creatorTeam);
        const spread = document.createElement("span");
        spread.className = "team-spread";
        spread.textContent = (selection.marketType || "spread") === "moneyline"
          ? "ML"
          : Number.isFinite(Number(selection.creatorSpread))
            ? spreadText(Number(selection.creatorSpread))
            : "—";
        choice.append(team, spread);

        const meta = document.createElement("span");
        meta.className = "side-bet-batch-ticket-meta";
        if (ticketIsComplete(selection)) {
          const recipientsText = recipientSummary(selection, payload);
          meta.textContent = `${Number(selection.amount).toFixed(Number(selection.amount) % 1 ? 2 : 0)} · ${recipientsText || "Recipient set"}`;
        } else {
          meta.textContent = "Tap to finish amount, line and recipient";
        }
        copy.append(choice, meta);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "side-bet-batch-remove";
        remove.setAttribute("aria-label", `Remove ${team.textContent}`);
        remove.textContent = "×";
        remove.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          captureCurrentTicket();
          const nativeBefore = currentNativeSelection();
          const removedWasNative = sameSelection(nativeBefore, selection);
          selections = selections.filter((candidate) => selectionKey(candidate) !== selectionKey(selection));
          pendingNativeSync = removedWasNative && selections.length > 0;
          if (!selections.length) syncNativeSelection();
          else if (removedWasNative) window.requestAnimationFrame(() => activateTicket(selections[selections.length - 1]));
          schedule();
        });

        row.append(copy, remove);
        list!.appendChild(row);
      });
    }

    function applyBatchUi(payload: CachedPayload | null) {
      annotateSideBetBoard(payload);
      annotateRecipients(payload);

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

      const submit = document.querySelector<HTMLButtonElement>(".side-bet-slip-submit");
      if (submit && batchPresentationActive) {
        const allReady = selections.length > 0 && selections.every(ticketIsComplete);
        submit.disabled = sending || !allReady;
        submit.dataset.batchReady = allReady ? "true" : "false";
        submit.setAttribute("aria-label", allReady ? `Send ${selections.length} side bet offers` : "Finish every selected side bet before sending");
      }

      if (pendingNativeSync && !sheet) {
        syncNativeSelection();
      }
    }

    async function sendBatch() {
      if (sending || selections.length < 1) return;
      captureCurrentTicket();
      const payload = readCachedPayload(appSlug);
      const token = window.localStorage.getItem("pickem_session_token");
      if (!payload || !token) {
        showBatchMessage("Could not read the current side bet selections. Try again.", "error");
        return;
      }

      const unfinished = selections.find((selection) => !ticketIsComplete(selection));
      if (unfinished) {
        showBatchMessage("Finish the amount, line and recipient for every selected bet before sending.", "error");
        activateTicket(unfinished);
        return;
      }

      const submit = document.querySelector<HTMLButtonElement>(".side-bet-slip-submit");
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
          body: JSON.stringify({
            selections: selections.map((selection) => ({
              gameId: selection.gameId,
              creatorTeam: selection.creatorTeam,
              creatorSpread: selection.marketType === "moneyline" ? 0 : Number(selection.creatorSpread),
              amount: Number(selection.amount),
              marketType: selection.marketType || "spread",
              creatorOdds: Number(selection.creatorOdds ?? 100),
              recipientIds: selection.recipientIds || []
            })),
            viewWeek: payload.week ?? selectedWeekFromHeader() ?? undefined
          })
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
        schedule();
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

      const modeButton = target.closest<HTMLButtonElement>(".side-bet-offer-mode-row button");
      if (modeButton) {
        selections = [];
        pendingNativeSync = false;
        schedule();
        return;
      }

      const nativeClear = target.closest<HTMLButtonElement>(".side-bet-slip-selection .side-bet-selection-clear:not(.side-bet-batch-remove)");
      if (nativeClear) {
        selections = [];
        pendingNativeSync = false;
        schedule();
        return;
      }

      const submit = target.closest<HTMLButtonElement>(".side-bet-slip-submit");
      if (submit && (selections.length > 1 || (selections.length === 1 && !nativeSelectionIsCurrent()))) {
        event.preventDefault();
        event.stopPropagation();
        void sendBatch();
        return;
      }

      const formControl = target.closest(".side-bet-market-section button, .side-bet-amount-grid button, .side-bet-recipient-grid label, .side-bet-recipient-grid input");
      if (formControl && selections.length > 1 && !suppressFormCapture) {
        const batchSubmit = document.querySelector<HTMLButtonElement>(".side-bet-slip-submit");
        if (batchSubmit) {
          batchSubmit.disabled = true;
          batchSubmit.dataset.batchReady = "false";
        }
        window.requestAnimationFrame(() => {
          captureCurrentTicket();
          schedule();
        });
      }

      const row = target.closest<HTMLButtonElement>(".side-bet-game-card .team-row");
      if (!row || row.disabled || suppressSelectionCapture) return;
      const liveMode = /live/i.test(document.querySelector<HTMLButtonElement>('.side-bet-two-option-toggle[aria-label="Choose pregame or live games"] button.active')?.textContent || "");
      const totalMode = /o\/u/i.test(document.querySelector<HTMLButtonElement>('.side-bet-two-option-toggle[aria-label="Choose spreads or over under"] button.active')?.textContent || "");
      if (liveMode || totalMode) return;
      const payload = readCachedPayload(appSlug);
      const card = row.closest<HTMLElement>(".side-bet-game-card");
      const game = card ? gameForCard(card, payload) : null;
      if (!game) return;
      const team = rawTeamForRow(row, game);
      if (!team) return;

      captureCurrentTicket();
      const clickedSelection = { gameId: game.id, creatorTeam: team };
      const nativeBefore = currentNativeSelection();
      const existingIndex = selections.findIndex((selection) => selection.gameId === game.id);
      if (existingIndex >= 0 && selections[existingIndex].creatorTeam === team) {
        selections = selections.filter((_, index) => index !== existingIndex);
        pendingNativeSync = sameSelection(nativeBefore, clickedSelection) && selections.length > 0;
      } else if (existingIndex >= 0) {
        selections = selections.map((selection, index) => index === existingIndex ? initialTicket(game, team) : selection);
        pendingNativeSync = false;
        window.requestAnimationFrame(() => applyTicketToNative(selections[existingIndex]));
      } else {
        if (selections.length >= MAX_BATCH_SELECTIONS) {
          event.preventDefault();
          event.stopPropagation();
          showBatchMessage(`You can select up to ${MAX_BATCH_SELECTIONS} side bets at a time.`, "error");
          return;
        }
        const nextTicket = initialTicket(game, team);
        selections = [...selections, nextTicket];
        pendingNativeSync = false;
        window.requestAnimationFrame(() => applyTicketToNative(nextTicket));
      }
      schedule();
      window.requestAnimationFrame(schedule);
    }

    function onFormInput(event: Event) {
      const target = event.target;
      if (!(target instanceof Element) || suppressFormCapture || selections.length < 2) return;
      if (!target.matches(".side-bet-spread-input, .side-bet-odds-input, .side-bet-risk-input")) return;
      window.requestAnimationFrame(() => {
        captureCurrentTicket();
        schedule();
      });
    }

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onDocumentClick, true);
    document.addEventListener("input", onFormInput, true);
    document.addEventListener("change", onFormInput, true);
    schedule();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("click", onDocumentClick, true);
      document.removeEventListener("input", onFormInput, true);
      document.removeEventListener("change", onFormInput, true);
      document.body.classList.remove("side-bet-batch-active");
      document.querySelector(".batch-side-bet-toast")?.remove();
    };
  }, []);

  return null;
}
