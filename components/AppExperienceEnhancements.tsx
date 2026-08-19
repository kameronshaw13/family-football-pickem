"use client";

import { useEffect } from "react";

type LedgerBet = {
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
};

type SideBetPayload = {
  currentUser?: { id: string; display_name?: string };
  week?: number;
  availableWeeks?: number[];
  sideBets?: LedgerBet[];
};

type Preferences = {
  mainTab?: string;
  sectionTabs?: Record<string, string>;
  menus?: Record<string, string>;
  ledgerWeek?: number;
};

const STORAGE_KEY = "pickem_ui_preferences_v1";
const WEEK_MENU_LABELS = new Set([
  "Select week",
  "Select standings week",
  "Select Bank results week",
  "Select side bet ledger week"
]);

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
    // Preferences are optional; the app remains fully usable without storage.
  }
}

function updatePreferences(mutator: (current: Preferences) => Preferences) {
  savePreferences(mutator(readPreferences()));
}

function cleanLabel(element: Element | null) {
  if (!element) return "";
  const numeric = element.querySelector<HTMLElement>(":scope > .custom-select-label > .numeric-token, :scope > .section-tab-label > .numeric-token");
  if (numeric?.textContent) return numeric.textContent.trim();
  return element.textContent?.trim() || "";
}

function primaryLabel(button: HTMLButtonElement) {
  return button.querySelector<HTMLElement>(":scope > span:last-child")?.textContent?.trim() || "";
}

function clickByLabel(root: ParentNode, selector: string, wanted: string) {
  const button = Array.from(root.querySelectorAll<HTMLButtonElement>(selector)).find((item) => cleanLabel(item) === wanted || primaryLabel(item) === wanted);
  if (!button || button.disabled) return false;
  button.click();
  return true;
}

function chooseMenu(ariaLabel: string, selectedText: string) {
  const trigger = document.querySelector<HTMLButtonElement>(`button[aria-label="${CSS.escape(ariaLabel)}"]`);
  if (!trigger || trigger.disabled) return false;
  if (cleanLabel(trigger) === selectedText) return true;
  trigger.click();
  const root = trigger.closest(".custom-select");
  return root ? clickByLabel(root, ".custom-select-option", selectedText) : false;
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
  if (prefs.mainTab) clickByLabel(document, ".primary-nav button", prefs.mainTab);

  window.setTimeout(() => {
    const panelKey = currentPanelKey();
    const panel = document.querySelector<HTMLElement>("main.container > section.panel");
    if (panelKey && panel && prefs.sectionTabs?.[panelKey]) clickByLabel(panel, ".section-tabs button", prefs.sectionTabs[panelKey]);
    window.setTimeout(() => {
      for (const [ariaLabel, selectedText] of Object.entries(prefs.menus || {})) chooseMenu(ariaLabel, selectedText);
    }, 0);
  }, 0);
}

function rememberClick(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const primary = target.closest<HTMLButtonElement>(".primary-nav button");
  if (primary) {
    const label = primaryLabel(primary);
    if (label) updatePreferences((prefs) => ({ ...prefs, mainTab: label }));
    return;
  }

  const sectionButton = target.closest<HTMLButtonElement>(".section-tabs button");
  if (sectionButton) {
    const label = cleanLabel(sectionButton);
    const panel = sectionButton.closest<HTMLElement>("section.panel");
    if (!label || !panel) return;
    const key = panel.classList.contains("picks-panel") ? "picks" : panel.classList.contains("card-panel") ? "card" : panel.classList.contains("standings-panel") ? "standings" : null;
    if (key) updatePreferences((prefs) => ({ ...prefs, sectionTabs: { ...(prefs.sectionTabs || {}), [key]: label } }));
    return;
  }

  const option = target.closest<HTMLButtonElement>(".custom-select-option");
  if (!option) return;
  const root = option.closest(".custom-select");
  const trigger = root?.querySelector<HTMLButtonElement>(".custom-select-trigger");
  const ariaLabel = trigger?.getAttribute("aria-label") || "";
  const label = cleanLabel(option);
  if (!ariaLabel || !label || WEEK_MENU_LABELS.has(ariaLabel)) return;
  updatePreferences((prefs) => ({ ...prefs, menus: { ...(prefs.menus || {}), [ariaLabel]: label } }));
}

function teamLogo(bet: LedgerBet, team: string) {
  if (!bet.game) return null;
  return team === bet.game.home_team ? bet.game.home_logo_url || null : bet.game.away_logo_url || null;
}

function spreadText(value: number | string) {
  const spread = Number(value);
  if (!Number.isFinite(spread)) return "";
  if (spread === 0) return "PK";
  return `${spread > 0 ? "+" : ""}${spread}`;
}

function moneyText(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  return `${sign}$${absolute.toFixed(Number.isInteger(absolute) ? 0 : 2)}`;
}

function createLedgerRow(bet: LedgerBet, currentUserId: string) {
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
  const logoUrl = coveredTeam ? teamLogo(bet, coveredTeam) : null;
  if (logoUrl) {
    const img = document.createElement("img");
    img.src = logoUrl;
    img.alt = "";
    img.className = "team-logo";
    img.width = 34;
    img.height = 34;
    img.loading = "lazy";
    img.decoding = "async";
    row.appendChild(img);
  } else {
    const fallback = document.createElement("div");
    fallback.className = "team-logo fallback";
    fallback.textContent = coveredTeam?.slice(0, 1) || "—";
    row.appendChild(fallback);
  }

  const copy = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = `${otherTeam} vs ${favoriteTeam} ${spreadText(favoriteSpread)}`;
  const detail = document.createElement("p");
  detail.textContent = `${creatorName} vs ${acceptorName} · ${winnerName ? `${winnerName} Wins` : "Push"}`;
  copy.append(title, detail);

  const amountNode = document.createElement("strong");
  amountNode.className = amount > 0 ? "money-pos" : amount < 0 ? "money-neg" : "money-neutral";
  amountNode.textContent = moneyText(amount);
  row.append(copy, amountNode);
  return row;
}

function renderLedger(payload: SideBetPayload, selectedWeek: number) {
  const heading = Array.from(document.querySelectorAll<HTMLElement>(".heading-with-badge")).find((item) => item.textContent?.includes("Side Bet Ledger"));
  const section = heading?.closest<HTMLElement>(".subsection.bank-section");
  if (!section) return;

  const currentWeek = Number(payload.week ?? Math.max(...(payload.availableWeeks?.length ? payload.availableWeeks : [0])));
  const weeks = Array.from(new Set((payload.availableWeeks || [currentWeek]).filter((week) => week <= currentWeek))).sort((a, b) => b - a);
  const safeWeek = weeks.includes(selectedWeek) ? selectedWeek : currentWeek;
  const settled = (payload.sideBets || []).filter((bet) => bet.status === "settled" && Number(bet.week) === safeWeek);
  const renderKey = `${safeWeek}:${settled.map((bet) => `${bet.id}:${bet.result}:${bet.winner_id || ""}`).join("|")}`;
  if (section.dataset.ledgerRenderKey === renderKey) return;
  section.dataset.ledgerRenderKey = renderKey;

  let controls = section.querySelector<HTMLElement>(".ledger-week-controls");
  if (!controls) {
    controls = document.createElement("div");
    controls.className = "ledger-week-controls";
    section.querySelector<HTMLElement>(".standings-heading-row")?.appendChild(controls);
  }
  controls.replaceChildren();

  const select = document.createElement("select");
  select.className = "ledger-week-select";
  select.setAttribute("aria-label", "Select side bet ledger week");
  for (const week of weeks) {
    const option = document.createElement("option");
    option.value = String(week);
    option.textContent = week === 0 ? "Week 0" : `Week ${week}`;
    option.selected = week === safeWeek;
    select.appendChild(option);
  }
  select.addEventListener("change", () => {
    const nextWeek = Number(select.value);
    updatePreferences((prefs) => ({ ...prefs, ledgerWeek: nextWeek }));
    section.dataset.ledgerRenderKey = "";
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
  list.replaceChildren();

  if (!settled.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No settled side bets this week.";
    list.appendChild(empty);
    return;
  }

  for (const bet of settled) list.appendChild(createLedgerRow(bet, payload.currentUser?.id || ""));
}

async function loadLedgerPayload() {
  const token = window.localStorage.getItem("pickem_session_token");
  if (!token) return null;
  try {
    const response = await fetch("/api/app-data", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });
    return response.ok ? await response.json() as SideBetPayload : null;
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
    let ledgerLoading = false;

    async function refreshLedger(force = false) {
      if (!document.querySelector(".standings-panel") || ledgerLoading) return;
      if (force) ledgerPayload = null;
      if (!ledgerPayload) {
        ledgerLoading = true;
        try {
          ledgerPayload = await loadLedgerPayload();
        } finally {
          ledgerLoading = false;
        }
      }
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
        void refreshLedger();
      });
    }

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    const onFocus = () => void refreshLedger(true);
    document.addEventListener("click", rememberClick, true);
    window.addEventListener("focus", onFocus);
    schedule();

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("click", rememberClick, true);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return null;
}
