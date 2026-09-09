"use client";

import { useEffect } from "react";

function syncToggle(root: HTMLElement, select: HTMLSelectElement) {
  root.querySelectorAll<HTMLButtonElement>(".side-bet-ledger-scope-button").forEach((button) => {
    const active = button.dataset.ledgerScope === select.value;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function enhance(root: HTMLElement) {
  if (root.dataset.ledgerToggleEnhanced === "1") return;
  const select = root.querySelector<HTMLSelectElement>("select");
  if (!select) return;

  root.dataset.ledgerToggleEnhanced = "1";
  root.classList.remove("compact-select", "custom-select", "ledger-scope-menu-select", "week-select-wrap", "header-menu-select", "open");
  root.classList.add("ledger-scope-toggle");
  select.hidden = true;
  root.querySelector<HTMLElement>(".side-bet-ledger-chevron")?.setAttribute("hidden", "");

  const makeButton = (value: "all" | "mine", label: string) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "side-bet-ledger-scope-button";
    button.dataset.ledgerScope = value;
    button.textContent = label;
    button.addEventListener("click", () => {
      if (select.value !== value) {
        select.value = value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      syncToggle(root, select);
    });
    return button;
  };

  root.append(makeButton("all", "All Bets"), makeButton("mine", "My Bets"));
  select.addEventListener("change", () => syncToggle(root, select));
  syncToggle(root, select);
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

    apply();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return null;
}
