"use client";

import { useEffect } from "react";
import type { AppSlug } from "@/lib/rulePresentation";

const STYLES = `
.manual-pick-lock{display:inline-flex;min-width:42px;height:28px;align-items:center;justify-content:center;padding:0 7px;border:1px solid var(--line-strong);border-radius:4px;color:var(--header-muted);background:transparent;font-family:var(--font-display);font-size:10px;font-weight:800;line-height:1;cursor:pointer}
.manual-pick-lock:disabled{cursor:default;opacity:.55}
.manual-lock-confirmed{display:inline-flex;min-width:42px;height:28px;align-items:center;justify-content:center;color:var(--muted);font-size:9px;font-weight:800}
.manual-lock-toast{position:fixed;right:12px;bottom:calc(var(--nav-height) + env(safe-area-inset-bottom) + 12px);left:12px;z-index:65;display:flex;min-height:44px;align-items:center;justify-content:center;padding:9px 12px;border:1px solid var(--line-strong);border-radius:5px;background:var(--panel);box-shadow:var(--shadow);color:var(--ink);font-size:12px;font-weight:800;text-align:center}
.manual-lock-toast.error{color:var(--red)}
`;

function selectedWeekFromHeader() {
  const text = document.querySelector<HTMLElement>(".week-select-wrap .custom-select-trigger")?.textContent || "";
  const match = text.match(/Week\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function syncWeekCookie() {
  const week = selectedWeekFromHeader();
  if (week == null) return;
  document.cookie = `pickem_view_week=${week}; path=/; SameSite=Lax`;
}

function showMessage(message: string, tone: "success" | "error" = "success") {
  document.querySelector(".manual-lock-toast")?.remove();
  const toast = document.createElement("div");
  toast.className = `manual-lock-toast ${tone}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 2800);
}

async function waitForAutosave() {
  const started = Date.now();
  while (document.querySelector(".autosave-toast") && Date.now() - started < 4000) {
    await new Promise((resolve) => window.setTimeout(resolve, 120));
  }
  return !document.querySelector(".autosave-toast");
}

export default function WeekScopeAndManualLockEnhancements({ appSlug }: { appSlug: AppSlug }) {
  useEffect(() => {
    const manuallyLocked = new Set<string>();
    let applying = false;

    const apply = () => {
      if (applying) return;
      applying = true;
      try {
        syncWeekCookie();
        document.querySelectorAll<HTMLElement>(".pick-card").forEach((card) => {
          const actions = card.querySelector<HTMLElement>(".pick-row-actions");
          const remove = actions?.querySelector<HTMLButtonElement>('button[aria-label^="Remove "]');
          if (!actions || !remove) return;
          const selectedTeam = remove.getAttribute("aria-label")?.replace(/^Remove\s+/, "").trim() || "";
          if (!selectedTeam) return;

          if (manuallyLocked.has(selectedTeam)) {
            remove.style.display = "none";
            if (!actions.querySelector(".manual-lock-confirmed")) {
              const confirmed = document.createElement("span");
              confirmed.className = "manual-lock-confirmed";
              confirmed.textContent = "Locked";
              actions.prepend(confirmed);
            }
            actions.querySelector(".manual-pick-lock")?.remove();
            return;
          }

          if (actions.querySelector(".manual-pick-lock")) return;
          const button = document.createElement("button");
          button.type = "button";
          button.className = "manual-pick-lock";
          button.textContent = "Lock";
          button.setAttribute("aria-label", `Lock ${selectedTeam} at current spread`);
          button.addEventListener("click", async () => {
            if (button.disabled) return;
            button.disabled = true;
            button.textContent = "Locking…";
            const saved = await waitForAutosave();
            const week = selectedWeekFromHeader();
            const token = window.localStorage.getItem("pickem_session_token");
            if (!saved || week == null || !token) {
              button.disabled = false;
              button.textContent = "Lock";
              showMessage("Pick is still saving. Try Lock again.", "error");
              return;
            }
            try {
              const response = await fetch("/api/picks/lock", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-pickem-group": appSlug },
                body: JSON.stringify({ week, selectedTeam })
              });
              const payload = await response.json();
              if (!response.ok) throw new Error(payload.error || "Pick could not be locked.");
              manuallyLocked.add(selectedTeam);
              apply();
              showMessage(`${selectedTeam} locked at the current spread.`);
            } catch (error) {
              button.disabled = false;
              button.textContent = "Lock";
              showMessage(error instanceof Error ? error.message : "Pick could not be locked.", "error");
            }
          });
          actions.prepend(button);
        });
      } finally {
        applying = false;
      }
    };

    apply();
    const observer = new MutationObserver(() => window.requestAnimationFrame(apply));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [appSlug]);

  return <style>{STYLES}</style>;
}
