"use client";

import { useEffect } from "react";

const ARIA_LABEL = "Filter side bet ledger";

function optionLabel(select: HTMLSelectElement) {
  return select.options[select.selectedIndex]?.textContent?.trim() || "All";
}

function makeChevron() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "custom-select-chevron");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "15");
  svg.setAttribute("height", "15");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "m6 9 6 6 6-6");
  svg.appendChild(path);
  return svg;
}

function closeMenu(root: HTMLElement) {
  root.classList.remove("open");
  root.querySelector(".custom-select-menu")?.remove();
  root.querySelector<HTMLButtonElement>(".custom-select-trigger")?.setAttribute("aria-expanded", "false");
}

function syncTrigger(root: HTMLElement, select: HTMLSelectElement) {
  const token = root.querySelector<HTMLElement>(".custom-select-trigger .numeric-token");
  if (token) token.textContent = optionLabel(select);
}

function openMenu(root: HTMLElement, select: HTMLSelectElement) {
  if (root.classList.contains("open")) {
    closeMenu(root);
    return;
  }

  document.querySelectorAll<HTMLElement>(".ledger-scope-menu-select.open").forEach((candidate) => closeMenu(candidate));
  root.classList.add("open");
  root.querySelector<HTMLButtonElement>(".custom-select-trigger")?.setAttribute("aria-expanded", "true");

  const menu = document.createElement("div");
  menu.className = "custom-select-menu";
  menu.setAttribute("role", "listbox");
  menu.setAttribute("aria-label", ARIA_LABEL);

  const section = document.createElement("div");
  section.className = "custom-select-section";
  Array.from(select.options).forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `custom-select-option ${option.value === select.value ? "selected" : ""}`.trim();
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", option.value === select.value ? "true" : "false");

    const label = document.createElement("span");
    label.className = "custom-select-label";
    const token = document.createElement("span");
    token.className = "numeric-token";
    token.textContent = option.textContent || "";
    label.appendChild(token);
    button.appendChild(label);

    button.addEventListener("click", () => {
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      syncTrigger(root, select);
      closeMenu(root);
    });
    section.appendChild(button);
  });
  menu.appendChild(section);
  root.appendChild(menu);
}

function enhance(root: HTMLElement) {
  if (root.dataset.ledgerMenuEnhanced === "1") return;
  const select = root.querySelector<HTMLSelectElement>("select");
  if (!select) return;

  root.dataset.ledgerMenuEnhanced = "1";
  root.classList.add("custom-select", "compact-select", "ledger-scope-menu-select");
  root.classList.remove("week-select-wrap", "header-menu-select");
  select.hidden = true;
  root.querySelector<HTMLElement>(".side-bet-ledger-chevron")?.setAttribute("hidden", "");

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "custom-select-trigger";
  trigger.setAttribute("aria-label", ARIA_LABEL);
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");

  const label = document.createElement("span");
  label.className = "custom-select-label";
  const token = document.createElement("span");
  token.className = "numeric-token";
  token.textContent = optionLabel(select);
  label.appendChild(token);
  trigger.appendChild(label);

  trigger.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    openMenu(root, select);
  });
  trigger.addEventListener("click", (event) => {
    if (event.detail === 0) openMenu(root, select);
  });
  select.addEventListener("change", () => syncTrigger(root, select));

  root.append(trigger, makeChevron());
}

export default function LedgerScopeMenuEnhancement() {
  useEffect(() => {
    let frame = 0;
    const apply = () => {
      document.querySelectorAll<HTMLElement>(".side-bet-ledger-scope").forEach(enhance);
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        apply();
      });
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      document.querySelectorAll<HTMLElement>(".ledger-scope-menu-select.open").forEach((root) => {
        if (!root.contains(event.target as Node)) closeMenu(root);
      });
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      document.querySelectorAll<HTMLElement>(".ledger-scope-menu-select.open").forEach(closeMenu);
    };

    apply();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
      document.querySelectorAll<HTMLElement>(".ledger-scope-menu-select.open").forEach(closeMenu);
    };
  }, []);

  return null;
}
