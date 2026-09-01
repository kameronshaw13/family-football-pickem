"use client";

import { useEffect } from "react";
import type { AppSlug } from "@/lib/rulePresentation";

const STYLES = `
.manual-pick-lock{display:inline-flex;min-width:58px;height:28px;align-items:center;justify-content:center;gap:5px;padding:0 8px;border:1px solid #b98f17;border-radius:4px;color:#2c2410;background:var(--gold);font-family:var(--font-display);font-size:10px;font-weight:800;line-height:1;cursor:pointer}
.manual-pick-lock svg{width:12px;height:12px;flex:0 0 auto;stroke:currentColor;stroke-width:2.2}
.manual-pick-lock:disabled{cursor:default;opacity:.55}
.manual-lock-confirmed{display:inline-flex;min-width:42px;height:28px;align-items:center;justify-content:center;color:var(--muted);font-size:9px;font-weight:800}
.manual-lock-toast{position:fixed;right:12px;bottom:calc(var(--nav-height) + env(safe-area-inset-bottom) + 12px);left:12px;z-index:65;display:flex;min-height:44px;align-items:center;justify-content:center;padding:9px 12px;border:1px solid var(--line-strong);border-radius:5px;background:var(--panel);box-shadow:var(--shadow);color:var(--ink);font-size:12px;font-weight:800;text-align:center}
.manual-lock-toast.error{color:var(--red)}
.manual-lock-review-backdrop{position:fixed;inset:0;z-index:80;display:flex;align-items:flex-end;justify-content:center;padding:12px 12px calc(var(--nav-height) + env(safe-area-inset-bottom) + 12px);background:rgba(10,15,18,.38)}
.manual-lock-review-sheet{width:min(440px,100%);padding:16px;border:1px solid var(--line-strong);border-radius:8px;background:var(--panel);box-shadow:0 18px 40px rgba(10,15,18,.25)}
.manual-lock-review-icon{display:grid;width:42px;height:42px;margin:0 auto 10px;place-items:center;border:1px solid #b98f17;border-radius:50%;color:#2c2410;background:var(--gold)}
.manual-lock-review-icon svg{width:20px;height:20px;stroke:currentColor;stroke-width:2.15}
.manual-lock-review-heading{text-align:center}
.manual-lock-review-heading span{display:block;margin-bottom:3px;color:var(--muted);font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.02em}
.manual-lock-review-heading h2{margin:0;color:var(--ink);font-size:19px;line-height:1.2}
.manual-lock-review-pick{display:grid;gap:3px;margin:14px 0 8px;padding:12px;border-block:1px solid var(--line);text-align:center}
.manual-lock-review-pick strong{font-size:15px}
.manual-lock-review-pick span{color:var(--header-muted);font-size:12px;font-weight:800}
.manual-lock-review-warning{margin:8px 4px 14px;color:var(--muted);font-size:11px;font-weight:700;line-height:1.45;text-align:center}
.manual-lock-review-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.manual-lock-review-actions button{min-height:38px;border-radius:4px;font-family:var(--font-display);font-size:12px;font-weight:800;cursor:pointer}
.manual-lock-review-cancel{border:1px solid var(--line-strong);background:transparent;color:var(--ink)}
.manual-lock-review-confirm{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid #b98f17;background:var(--gold);color:#2c2410}
.manual-lock-review-confirm svg{width:13px;height:13px;stroke:currentColor;stroke-width:2.2}
.manual-lock-review-actions button:disabled{cursor:default;opacity:.55}
`;

const keyIcon = () => `
<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="8" cy="15" r="4"></circle>
  <path d="M11 12l9-9M16 7l3 3M14 9l2 2"></path>
</svg>`;

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

function spreadTextFromCard(card: HTMLElement) {
  const market = card.querySelector<HTMLElement>(".pick-title-market")?.textContent?.trim() || "";
  const match = market.match(/(?:Pick'em|[+-]\d+(?:\.5)?)/i);
  return match?.[0] || "current spread";
}

function openReview({ selectedTeam, spread, confirm }: { selectedTeam: string; spread: string; confirm: (setBusy: (busy: boolean) => void, close: () => void) => void }) {
  document.querySelector(".manual-lock-review-backdrop")?.remove();
  const backdrop = document.createElement("div");
  backdrop.className = "manual-lock-review-backdrop";
  backdrop.innerHTML = `
    <section class="manual-lock-review-sheet" role="dialog" aria-modal="true" aria-labelledby="manual-lock-review-title">
      <div class="manual-lock-review-icon">${keyIcon()}</div>
      <div class="manual-lock-review-heading"><span>Review pick lock</span><h2 id="manual-lock-review-title">Lock this pick?</h2></div>
      <div class="manual-lock-review-pick"><strong></strong><span></span></div>
      <p class="manual-lock-review-warning">This locks only this pick at the spread shown below. It cannot be unlocked or changed later. Your other unlocked picks will remain editable.</p>
      <div class="manual-lock-review-actions">
        <button type="button" class="manual-lock-review-cancel">Cancel</button>
        <button type="button" class="manual-lock-review-confirm">Confirm lock ${keyIcon()}</button>
      </div>
    </section>`;
  const pickStrong = backdrop.querySelector<HTMLElement>(".manual-lock-review-pick strong");
  const pickSpread = backdrop.querySelector<HTMLElement>(".manual-lock-review-pick span");
  if (pickStrong) pickStrong.textContent = selectedTeam;
  if (pickSpread) pickSpread.textContent = spread;
  const cancel = backdrop.querySelector<HTMLButtonElement>(".manual-lock-review-cancel");
  const confirmButton = backdrop.querySelector<HTMLButtonElement>(".manual-lock-review-confirm");
  const close = () => backdrop.remove();
  const setBusy = (busy: boolean) => {
    if (cancel) cancel.disabled = busy;
    if (confirmButton) {
      confirmButton.disabled = busy;
      confirmButton.innerHTML = busy ? "Locking…" : `Confirm lock ${keyIcon()}`;
    }
  };
  cancel?.addEventListener("click", close);
  backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(); });
  confirmButton?.addEventListener("click", () => confirm(setBusy, close));
  document.body.appendChild(backdrop);
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
          button.innerHTML = `Lock ${keyIcon()}`;
          button.setAttribute("aria-label", `Lock ${selectedTeam} at current spread`);
          button.addEventListener("click", () => {
            if (button.disabled) return;
            const spread = spreadTextFromCard(card);
            openReview({
              selectedTeam,
              spread,
              confirm: async (setBusy, close) => {
                setBusy(true);
                const saved = await waitForAutosave();
                const week = selectedWeekFromHeader();
                const token = window.localStorage.getItem("pickem_session_token");
                if (!saved || week == null || !token) {
                  setBusy(false);
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
                  close();
                  apply();
                  showMessage(`${selectedTeam} locked at ${payload.pick?.locked_spread != null ? Number(payload.pick.locked_spread) > 0 ? `+${payload.pick.locked_spread}` : String(payload.pick.locked_spread) : spread}.`);
                } catch (error) {
                  setBusy(false);
                  showMessage(error instanceof Error ? error.message : "Pick could not be locked.", "error");
                }
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
      document.querySelector(".manual-lock-review-backdrop")?.remove();
    };
  }, [appSlug]);

  return <style>{STYLES}</style>;
}
