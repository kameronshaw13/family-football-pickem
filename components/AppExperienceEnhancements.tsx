"use client";

import { useEffect } from "react";

type Preferences = {
  mainTab?: string;
  sectionTabs?: Record<string, string>;
  menus?: Record<string, string>;
  ledgerWeek?: number;
};

const STORAGE_KEY = "pickem_ui_preferences_v2";
const LEGACY_STORAGE_KEY = "pickem_ui_preferences_v1";
const WEEK_MENU_LABELS = new Set([
  "Select week",
  "Select standings week",
  "Select Bank results week",
  "Select side bet ledger week"
]);
const MISSISSIPPI_VALLEY_PATTERN = /\bMississippi Valley State(?: Delta Devils| Delta)\b/g;

function readPreferences(): Preferences {
  try {
    return JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "{}") as Preferences;
  } catch {
    return {};
  }
}

function savePreferences(next: Preferences) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Preferences are optional; the app remains fully usable without storage.
  }
}

function clearLegacyPreferences() {
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // The legacy preference is non-critical and can be left behind if storage is unavailable.
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

function correctTeamName(value: string) {
  return value.replace(MISSISSIPPI_VALLEY_PATTERN, "Mississippi Valley State");
}

function correctElementAttributes(element: Element) {
  for (const attribute of ["aria-label", "title"]) {
    const current = element.getAttribute(attribute);
    if (!current) continue;
    const next = correctTeamName(current);
    if (next !== current) element.setAttribute(attribute, next);
  }
}

function correctTeamNames(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    const current = root.nodeValue || "";
    const next = correctTeamName(current);
    if (next !== current) root.nodeValue = next;
    return;
  }
  if (!(root instanceof Element) && root !== document.body) return;
  if (root instanceof Element) correctElementAttributes(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let text = walker.nextNode();
  while (text) {
    const current = text.nodeValue || "";
    const next = correctTeamName(current);
    if (next !== current) text.nodeValue = next;
    text = walker.nextNode();
  }
  if (root instanceof Element) root.querySelectorAll("[aria-label], [title]").forEach(correctElementAttributes);
}

export default function AppExperienceEnhancements() {
  useEffect(() => {
    let active = true;
    let frame = 0;
    let restored = false;

    clearLegacyPreferences();
    correctTeamNames(document.body);

    function scheduleRestore() {
      if (restored) return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (!active || restored) return;
        if (!document.querySelector(".app-shell:not(.loading-shell)")) return;
        restored = true;
        restorePreferences();
        restoreObserver.disconnect();
      });
    }

    const restoreObserver = new MutationObserver(scheduleRestore);
    restoreObserver.observe(document.body, { subtree: true, childList: true });

    const teamObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          correctTeamNames(mutation.target);
          continue;
        }
        if (mutation.type === "attributes" && mutation.target instanceof Element) {
          correctElementAttributes(mutation.target);
          continue;
        }
        mutation.addedNodes.forEach(correctTeamNames);
      }
    });
    teamObserver.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-label", "title"]
    });

    document.addEventListener("click", rememberClick, true);
    scheduleRestore();

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      restoreObserver.disconnect();
      teamObserver.disconnect();
      document.removeEventListener("click", rememberClick, true);
    };
  }, []);

  return null;
}
