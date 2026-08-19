"use client";

import { useEffect } from "react";

type SideBetPayload = {
  currentUser?: { id: string; display_name?: string };
  week?: number;
  availableWeeks?: number[];
  sideBets?: Array<{
    id: string;
    week: number;
    creator_id: string;
    creator_team: string;
    offered_team: string;
    creator_spread: number | string;
    offered_spread: number | string;
    amount: number | string;
    status: string;
    accepted_by?: string | null;
    winner_id?: string | null;
    result: string;
    creator?: { display_name?: string | null } | null;
    accepted_by_profile?: { display_name?: string | null } | null;
    game?: {
      away_team: string;
      home_team: string;
      away_logo_url?: string | null;
      home_logo_url?: string | null;
    } | null;
  }>;
};

const STORAGE_KEY = "pickem_ui_preferences_v1";
const WEEK_MENU_LABELS = new Set(["Select week", "Select standings week", "Select Bank results week", "Select side bet ledger week"]);

type Preferences = {
  mainTab?: string;
  sectionTabs?: Record<string, string>;
  menus?: Record<string, string>;
  ledgerWeek?: number;
};

function readPreferences(): Preferences {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") as Preferences;
  } catch {
    return {};
  }
}

function savePreferences(next: Preferences) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage preferences are optional.
  }
}

function updatePreferences(mutator: (current: Preferences) => Preferences) {
  savePreferences(mutator(readPreferences()));
}

function clickByText(root: ParentNode, selector: string, text: string) {
  const button = Array.from(root.querySelectorAll<HTMLButtonElement>(selector)).find((item) => item.textContent?.trim() === text);
  if (!button || button.disabled) return false;
  button.click();
  return true;
}

function chooseMenu(ariaLabel: string, selectedText: string) {
  const trigger = document.querySelector<HTMLButtonElement>(`button[aria-label="${CSS.escape(ariaLabel)}"]`);
  if (!trigger || trigger.disabled) return false;
  const current = trigger.querySelector(".custom-select-label")?.textContent?.trim() || "";
  if (current === selectedText) return true;
  trigger.click();
  const root = trigger.closest(".custom-select");
  if (!root) return false;
  return clickByText(root, ".custom-select-option", selectedText);
}

function currentPanelKey() {
  const panel = document.querySelector<HTMLElement>("main.container > section.panel");
  if (!panel) return null;
  if (panel.classList.contains("picks-panel")) return "picks";
  if (panel.classList.contains("card-panel")) return "card";
  if (panel.classList.contains("standings-panel")) return "standings";
  if (panel.classList.contains("rules-panel")) return "rules";
  return null;
}

function restorePreferences() {
  if (new URL(window.location.href).searchParams.has("notification")) return;
  const prefs = readPreferences();
  if (prefs.mainTab) clickByText(document, ".primary-nav button", prefs.mainTab);

  window.setTimeout(() => {
    const panelKey = currentPanelKey();
    if (panelKey && prefs.sectionTabs?.[panelKey]) {
      const panel = document.querySelector<HTMLElement>("main.container > section.panel");
      if (panel) clickByText(panel, ".section-tabs button", prefs.sectionTabs[panelKey]);
    }
    window.setTimeout(() => {
      for (const [ariaLabel, selectedText] of Object.entries(prefs.menus || {})) {
        chooseMenu(ariaLabel, selectedText);
      }
    }, 0);
  }, 0);
}

function rememberClick(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const primary = target.closest<HTMLButtonElement>(".primary-nav button");
  if (primary) {
    const label = primary.textContent?.trim();
    if (label) updatePreferences((prefs) => ({ ...prefs, mainTab: label }));
    return;
  }

  const sectionButton = target.closest<HTMLButtonElement>(".section-tabs button");
  if (sectionButton) {
    const label = sectionButton.textContent?.trim();
    const panel = sectionButton.closest<HTMLElement>("section.panel");
    if (!label || !panel) return;
    const key = panel.classList.contains("picks-panel") ? "picks" : panel.classList.contains("card-panel") ? "card" : panel.classList.contains("standings-panel") ? "standings" : null;
    if (!key) return;
    updatePreferences((prefs) => ({ ...prefs, sectionTabs: { ...(prefs.sectionTabs || {}), [key]: label } }));
    return;
  }

  const option = target.closest<HTMLButtonElement>(".custom-select-option");
  if (option) {
    const root = option.closest(".custom-select");
    const trigger = root?.querySelector<HTMLButtonElement>(".custom-select-trigger");
    const ariaLabel = trigger?.getAttribute("aria-label") || "";
    const label = option.textContent?.trim() || "";
    if (!ariaLabel || !label || WEEK_MENU_LABELS.has(ariaLabel)) return;
    updatePreferences((prefs) => ({ ...prefs, menus: { ...(prefs.menus || {}), [ariaLabel]: label } }));
  }
}

function optimisticOfferPreview(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const submit = target.closest<HTMLButtonElement>(".side-bet-slip-submit");
  if (!submit || submit.disabled) return;
  const sheet = submit.closest<HTMLElement>(".side-bet-slip-sheet");
  if (!sheet) return;

  const selectedTeam = sheet.querySelector<HTMLElement>(".side-bet-slip-selection .team-name")?.textContent?.trim() || "Selected team";
  const spread = sheet.querySelector<HTMLElement>(".side-bet-slip-selection .team-spread")?.textContent?.trim() || "";
  const amount = sheet.querySelector<HTMLButtonElement>(".side-bet-amount-grid button.active")?.textContent?.trim() || "$20";
  const recipients = Array.from(sheet.querySelectorAll<HTMLInputElement>('.side-bet-recipient-grid input[type="checkbox"]:checked'))
    .map((input) => input.closest("label")?.querySelector("span")?.textContent?.trim())
    .filter(Boolean)
    .join(" or ") || "recipient";

  const trigger = document.querySelector<HTMLButtonElement>('button[aria-label="Choose side bet view"]');
  trigger?.click();
  window.requestAnimationFrame(() => {
    const root = trigger?.closest(".custom-select");
    if (root) clickByText(root, ".custom-select-option", "Sent");
    window.requestAnimationFrame(() => {
      const list = document.querySelector<HTMLElement>(".side-bet-center .side-bet-list");
      if (!list || list.querySelector(".optimistic-side-bet")) return;
      const card = document.createElement("article");
      card.className = "side-bet-card mode-sent open optimistic-side-bet";
      card.innerHTML = `<div class="side-bet-offer-row"><div class="team-logo fallback">${selectedTeam.slice(0, 1)}</div><div class="side-bet-offer-copy"><strong>${selectedTeam} ${spread}</strong><p><span class="side-bet-response pending">Sending</span> to ${recipients}</p></div><strong class="side-bet-offer-amount money-neutral">${amount}</strong></div>`;
      list.prepend(card);
    });
  });
}

function settleOptimisticCard() {
  const optimistic = document.querySelector<HTMLElement>(".optimistic-side-bet");
  if (!optimistic) return;
  const toast = document.querySelector<HTMLElement>(".toast");
  const text = toast?.textContent || "";
  if (/Side bet offer sent/i.test(text)) optimistic.remove();
  if (/Side bet action failed|could not|failed/i.test(text)) optimistic.remove();
}

function teamLogo(bet: NonNullable<SideBetPayload["sideBets"]>[number], team: string) {
  if (!bet.game) return null;
  return team === bet.game.home_team ? bet.game.home_logo_url || null : bet.game.away_logo_url || null;
}

function spreadText(value: number | string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  if (n === 0) return "PK";
  return `${n > 0 ? "+" : ""}${n}`;
}

function moneyText(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(Number.isInteger(Math.abs(value)) ? 0 : 2)}`;
}

function renderLedger(payload: SideBetPayload, selectedWeek: number) {
  const heading = Array.from(document.querySelectorAll<HTMLElement>(".heading-with-badge")).find((item) => item.textContent?.includes("Side Bet Ledger"));
  const section = heading?.closest<HTMLElement>(".subsection.bank-section");
  if (!section) return;

  const currentUserId = payload.currentUser?.id || "";
  const settled = (payload.sideBets || []).filter((bet) => bet.status === "settled" && Number(bet.week) === selectedWeek);

  let controls = section.querySelector<HTMLElement>(".ledger-week-controls");
  if (!controls) {
    controls = document.createElement("div");
    controls.className = "ledger-week-controls";
    const headingRow = section.querySelector<HTMLElement>(".standings-heading-row");
    headingRow?.appendChild(controls);
  }

  const weeks = Array.from(new Set((payload.availableWeeks || []).filter((week) => week <= Number(payload.week ?? week)))).sort((a, b) => b - a);
  controls.innerHTML = "";
  const select = document.createElement("select");
  select.className = "ledger-week-select";
  select.setAttribute("aria-label", "Select side bet ledger week");
  for (const week of weeks) {
    const option = document.createElement("option");
    option.value = String(week);
    option.textContent = week === 0 ? "Week 0" : `Week ${week}`;
    option.selected = week === selectedWeek;
    select.appendChild(option);
  }
  select.addEventListener("change", () => {
    const nextWeek = Number(select.value);
    updatePreferences((prefs) => ({ ...prefs, ledgerWeek: nextWeek }));
    renderLedger(payload, nextWeek);
  });
  controls.appendChild(select);

  const original = section.querySelector<HTMLElement>(":scope > .ledger-list:not(.enhanced-ledger-list)");
  if (original) original.hidden = true;
  let list = section.querySelector<HTMLElement>(".enhanced-ledger-list");
  if (!list) {
    list = document.createElement("div");
    list.className = "ledger-list enhanced-ledger-list";
    section.appendChild(list);
  }
  list.innerHTML = "";

  if (!settled.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No settled side bets this week.";
    list.appendChild(empty);
    return;
  }

  for (const bet of settled) {
    const favoriteTeam = Number(bet.creator_spread) < 0 ? bet.creator_team : Number(bet.offered_spread) < 0 ? bet.offered_team : bet.creator_team;
    const favoriteSpread = favoriteTeam === bet.creator_team ? Number(bet.creator_spread) : Number(bet.offered_spread);
    const otherTeam = favoriteTeam === bet.creator_team ? bet.offered_team : bet.creator_team;
    const coveredTeam = bet.result === "creator_win" ? bet.creator_team : bet.result === "acceptor_win" ? bet.offered_team : null;
    const creatorName = bet.creator?.display_name || "Player";
    const acceptorName = bet.accepted_by_profile?.display_name || "Opponent";
    const winnerName = bet.result === "creator_win" ? creatorName : bet.result === "acceptor_win" ? acceptorName : null;
    const stake = Number(bet.amount);
    const userWon = bet.winner_id === currentUserId || (!bet.winner_id && bet.result === "creator_win" && bet.creator_id === currentUserId) || (!bet.winner_id && bet.result === "acceptor_win" && bet.accepted_by === currentUserId);
    const involved = bet.creator_id === currentUserId || bet.accepted_by === currentUserId;
    const amount = bet.result === "push" || !involved ? 0 : userWon ? stake : -stake;

    const row = document.createElement("div");
    row.className = "ledger-row side-bet-ledger-row";
    const logo = coveredTeam ? teamLogo(bet, coveredTeam) : null;
    row.innerHTML = `${logo ? `<img src="${logo}" alt="" class="team-logo" width="34" height="34" loading="lazy" decoding="async" />` : `<div class="team-logo fallback">${coveredTeam?.slice(0, 1) || "—"}</div>`}<div><strong>${otherTeam} vs ${favoriteTeam} ${spreadText(favoriteSpread)}</strong><p>${creatorName} vs ${acceptorName} · ${winnerName ? `${winnerName} Wins` : "Push"}</p></div><strong class="${amount > 0 ? "money-pos" : amount < 0 ? "money-neg" : "money-neutral"}">${moneyText(amount)}</strong>`;
    list.appendChild(row);
  }
}

async function loadLedgerPayload() {
  const token = window.localStorage.getItem("pickem_session_token");
  if (!token) return null;
  try {
    const response = await fetch("/api/app-data", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!response.ok) return null;
    return await response.json() as SideBetPayload;
  } catch {
    return null;
  }
}

export default function AppExperienceEnhancements() {
  useEffect(() => {
    let active = true;
    let frame = 0;
    let restored = false;
    let ledgerPayload: SideBetPayload | null = null;

    async function refreshLedger() {
      if (!document.querySelector(".standings-panel")) return;
      if (!ledgerPayload) ledgerPayload = await loadLedgerPayload();
      if (!active || !ledgerPayload) return;
      const prefs = readPreferences();
      const available = ledgerPayload.availableWeeks || [];
      const preferred = prefs.ledgerWeek;
      const selected = preferred != null && available.includes(preferred) ? preferred : Number(ledgerPayload.week ?? available[0] ?? 0);
      renderLedger(ledgerPayload, selected);
    }

    function schedule() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (!active) return;
        const ready = Boolean(document.querySelector(".app-shell:not(.loading-shell)"));
        if (ready && !restored) {
          restored = true;
          restorePreferences();
        }
        settleOptimisticCard();
        void refreshLedger();
      });
    }

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    document.addEventListener("click", rememberClick, true);
    document.addEventListener("click", optimisticOfferPreview, true);
    window.addEventListener("focus", schedule);
    schedule();

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("click", rememberClick, true);
      document.removeEventListener("click", optimisticOfferPreview, true);
      window.removeEventListener("focus", schedule);
    };
  }, []);

  return null;
}
