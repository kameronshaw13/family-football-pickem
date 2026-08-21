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
    // Session preferences are optional.
  }
}

function clearLegacyPreferences() {
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Non-critical cleanup.
  }
}

function updatePreferences(mutator: (current: Preferences) => Preferences) {
  savePreferences(mutator(readPreferences()));
}

function cleanLabel(element: Element | null) {
  if (!element) return "";
  const numeric = element.querySelector<HTMLElement>(":scope > .custom-select-label > .numeric-token, :scope > .section-tab-label > .numeric-token");
  return numeric?.textContent?.trim() || element.textContent?.trim() || "";
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

function closeConfirmationOnBackdrop(event: PointerEvent) {
  const target = event.target;
  if (!(target instanceof Element) || !target.classList.contains("confirmation-backdrop")) return;
  const cancel = target.querySelector<HTMLButtonElement>(".confirmation-actions .btn.secondary");
  cancel?.click();
}

function appPath(pathname: string) {
  if (pathname === "/friends" || pathname.startsWith("/friends/")) return "/friends";
  if (pathname === "/caleb-family" || pathname.startsWith("/caleb-family/")) return "/caleb-family";
  return "/";
}

function workerScope() {
  const current = appPath(window.location.pathname);
  return current === "/friends" ? "/friends/" : current === "/caleb-family" ? "/caleb-family/" : "/";
}

export default function AppExperienceEnhancements() {
  useEffect(() => {
    let active = true;
    let frame = 0;
    let restored = false;

    clearLegacyPreferences();
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js", { scope: workerScope() }).catch(() => undefined);

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

    function receivePush(event: MessageEvent<{ type?: string; url?: string }>) {
      if (event.data?.type !== "notification-push") return;
      const target = new URL(event.data.url || "/", window.location.origin);
      if (appPath(target.pathname) !== appPath(window.location.pathname)) return;
      window.location.reload();
    }

    const restoreObserver = new MutationObserver(scheduleRestore);
    restoreObserver.observe(document.body, { subtree: true, childList: true });
    document.addEventListener("click", rememberClick, true);
    document.addEventListener("pointerdown", closeConfirmationOnBackdrop, true);
    navigator.serviceWorker?.addEventListener("message", receivePush);
    scheduleRestore();

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      restoreObserver.disconnect();
      document.removeEventListener("click", rememberClick, true);
      document.removeEventListener("pointerdown", closeConfirmationOnBackdrop, true);
      navigator.serviceWorker?.removeEventListener("message", receivePush);
    };
  }, []);

  return null;
}
