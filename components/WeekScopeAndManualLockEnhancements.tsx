"use client";

import { useEffect } from "react";
import type { AppSlug } from "@/lib/rulePresentation";

const STYLES = `
.manual-pick-lock{display:inline-flex;min-width:60px;height:28px;align-items:center;justify-content:center;gap:5px;padding:0 8px;border:1px solid #b88912;border-radius:4px;color:#3d2a00;background:var(--gold);font-family:var(--font-display);font-size:10px;font-weight:900;line-height:1;cursor:pointer}
.manual-pick-lock svg{width:12px;height:12px;stroke-width:2.2}
.manual-pick-lock:disabled{cursor:default;opacity:.55}
.manual-lock-confirmed{display:inline-flex;min-width:42px;height:28px;align-items:center;justify-content:center;color:var(--muted);font-size:9px;font-weight:800}
.manual-lock-toast{position:fixed;right:12px;bottom:calc(var(--nav-height) + env(safe-area-inset-bottom) + 12px);left:12px;z-index:65;display:flex;min-height:44px;align-items:center;justify-content:center;padding:9px 12px;border:1px solid var(--line-strong);border-radius:5px;background:var(--panel);box-shadow:var(--shadow);color:var(--ink);font-size:12px;font-weight:800;text-align:center}
.manual-lock-toast.error{color:var(--red)}
.manual-lock-review .confirmation-matchup{grid-template-columns:1fr}
.manual-lock-review .confirmation-matchup>div{min-height:70px}
.manual-lock-review .confirmation-actions{grid-template-columns:1fr 1fr}
.manual-lock-review .manual-lock-confirm-btn{color:#3d2a00;background:var(--gold);border-color:#b88912}
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

function iconMarkup() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="currentColor"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-linecap="round"/></svg>`;
}

function closeReview() {
  document.querySelector(".manual-lock-review-backdrop")?.remove();
}

function openReview(selectedTeam: string, spreadText: string, onConfirm: () => Promise<void>) {
  closeReview();
  const backdrop = document.createElement("div");
  backdrop.className = "confirmation-backdrop manual-lock-review-backdrop";
  backdrop.innerHTML = `
    <section class="confirmation-sheet manual-lock-review" role="dialog" aria-modal="true" aria-labelledby="manual-lock-title">
      <div class="confirmation-heading"><span>Review pick</span><h2 id="manual-lock-title">Lock pick?</h2></div>
      <div class="confirmation-matchup"><div><span>Locking</span><strong>${selectedTeam} ${spreadText}</strong></div></div>
      <p class="confirmation-kickoff">This cannot be undone.</p>
      <div class="confirmation-actions"><button type="button" class="btn secondary manual-lock-cancel">Cancel</button><button type="button" class="btn manual-lock-confirm-btn">Confirm lock</button></div>
    </section>`;
  document.body.appendChild(backdrop);
  backdrop.querySelector<HTMLButtonElement>(".manual-lock-cancel")?.addEventListener("click", closeReview);
  backdrop.addEventListener("click", (event) => { if (event.target === backdrop) closeReview(); });
  backdrop.querySelector<HTMLButtonElement>(".manual-lock-confirm-btn")?.addEventListener("click", async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = "Locking…";
    await onConfirm();
  });
}

function spreadFromCard(card: HTMLElement) {
  const text = card.querySelector<HTMLElement>(".pick-title-market")?.textContent || "";
  return text.replace(/·.*$/, "").trim();
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
          button.innerHTML = `<span>Lock</span>${iconMarkup()}`;
          button.setAttribute("aria-label", `Lock ${selectedTeam} at current spread`);
          button.addEventListener("click", () => {
            if (button.disabled) return;
            const spreadText = spreadFromCard(card) || "current spread";
            openReview(selectedTeam, spreadText, async () => {
              button.disabled = true;
              const saved = await waitForAutosave();
              const week = selectedWeekFromHeader();
              const token = window.localStorage.getItem("pickem_session_token");
              if (!saved || week == null || !token) {
                button.disabled = false;
                closeReview();
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
                closeReview();
                apply();
                showMessage(`${selectedTeam} locked at the current spread.`);
              } catch (error) {
                button.disabled = false;
                closeReview();
                showMessage(error instanceof Error ? error.message : "Pick could not be locked.", "error");
              }
            });
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
    return () => {
      observer.disconnect();
      closeReview();
    };
  }, [appSlug]);

  return <style>{STYLES}</style>;
}
