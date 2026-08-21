"use client";

import { useEffect } from "react";

type Preferences = {
  mainTab?: string;
  sectionTabs?: Record<string, string>;
  menus?: Record<string, string>;
};

const STORAGE_KEY = "pickem_ui_preferences_v2";
const LEGACY_STORAGE_KEY = "pickem_ui_preferences_v1";
const WEEK_MENU_LABELS = new Set(["Select week", "Select profile year"]);

function readPreferences(): Preferences {
  try { return JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "{}") as Preferences; } catch { return {}; }
}
function savePreferences(next: Preferences) { try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {} }
function clearLegacyPreferences() { try { window.localStorage.removeItem(LEGACY_STORAGE_KEY); } catch {} }
function updatePreferences(mutator: (current: Preferences) => Preferences) { savePreferences(mutator(readPreferences())); }
function cleanLabel(element: Element | null) {
  if (!element) return "";
  return element.textContent?.replace(/\s+/g, " ").trim() || "";
}
function primaryLabel(button: HTMLButtonElement) { return button.querySelector<HTMLElement>(":scope > span:last-child")?.textContent?.trim() || ""; }
function clickByLabel(root: ParentNode, selector: string, wanted: string) {
  const button = Array.from(root.querySelectorAll<HTMLButtonElement>(selector)).find((item) => cleanLabel(item) === wanted || primaryLabel(item) === wanted);
  if (!button || button.disabled) return false;
  button.click();
  return true;
}
function chooseMenu(ariaLabel: string, selectedText: string) {
  const trigger = document.querySelector<HTMLButtonElement>(`button[aria-label="${CSS.escape(ariaLabel)}"]`);
  if (!trigger || trigger.disabled) return false;
  const visible = cleanLabel(trigger).replace(/\s+\d+$/, "").trim();
  if (visible === selectedText) return true;
  trigger.click();
  const root = trigger.closest(".custom-select");
  if (!root) return false;
  const option = Array.from(root.querySelectorAll<HTMLButtonElement>(".custom-select-option")).find((item) => cleanLabel(item).replace(/\s+\d+$/, "").trim() === selectedText);
  if (!option || option.disabled) return false;
  option.click();
  return true;
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
    const label = cleanLabel(sectionButton).replace(/\s+\d+$/, "").trim();
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
  const label = cleanLabel(option).replace(/\s+\d+$/, "").trim();
  if (!ariaLabel || !label || WEEK_MENU_LABELS.has(ariaLabel)) return;
  updatePreferences((prefs) => ({ ...prefs, menus: { ...(prefs.menus || {}), [ariaLabel]: label } }));
}
function closeConfirmationOnBackdrop(event: PointerEvent) {
  const target = event.target;
  if (!(target instanceof Element) || !target.classList.contains("confirmation-backdrop")) return;
  target.querySelector<HTMLButtonElement>(".confirmation-actions .btn.secondary")?.click();
}

export default function AppExperienceEnhancements() {
  useEffect(() => {
    let active = true;
    let frame = 0;
    let restored = false;
    clearLegacyPreferences();

    function scheduleRestore() {
      if (restored) return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (!active || restored || !document.querySelector(".app-shell:not(.loading-shell)")) return;
        restored = true;
        restorePreferences();
        restoreObserver.disconnect();
      });
    }

    const restoreObserver = new MutationObserver(() => scheduleRestore());
    restoreObserver.observe(document.body, { subtree: true, childList: true });
    document.addEventListener("click", rememberClick, true);
    document.addEventListener("pointerdown", closeConfirmationOnBackdrop, true);
    scheduleRestore();

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      restoreObserver.disconnect();
      document.removeEventListener("click", rememberClick, true);
      document.removeEventListener("pointerdown", closeConfirmationOnBackdrop, true);
    };
  }, []);
  return null;
}
