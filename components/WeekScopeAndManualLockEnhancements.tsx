"use client";

import { useEffect } from "react";
import type { AppSlug } from "@/lib/rulePresentation";

const STYLES = `
.manual-pick-lock{display:inline-flex;min-width:60px;height:28px;align-items:center;justify-content:center;gap:5px;padding:0 8px;border:1px solid #b88912;border-radius:4px;color:var(--ink);background:var(--gold);font-family:var(--font-display);font-size:10px;font-weight:900;line-height:1;cursor:pointer}
.manual-pick-lock svg{width:12px;height:12px;stroke-width:2.2;color:var(--ink)}
.manual-pick-lock:disabled{cursor:default;opacity:.55}
.manual-lock-confirmed{display:inline-flex;min-width:42px;height:28px;align-items:center;justify-content:center;color:var(--muted);font-size:9px;font-weight:800}
.manual-lock-toast{position:fixed;right:12px;bottom:calc(var(--nav-height) + env(safe-area-inset-bottom) + 12px);left:12px;z-index:65;display:flex;min-height:44px;align-items:center;justify-content:center;padding:9px 12px;border:1px solid var(--line-strong);border-radius:5px;background:var(--panel);box-shadow:var(--shadow);color:var(--ink);font-size:12px;font-weight:800;text-align:center}
.manual-lock-toast.error{color:var(--red)}
.manual-lock-review .confirmation-heading{margin-bottom:10px}
.manual-lock-review .confirmation-heading h2{margin:0}
.manual-lock-review .confirmation-matchup{grid-template-columns:1fr}
.manual-lock-review .confirmation-matchup>div.manual-lock-pick-cell{display:flex;min-height:64px;align-items:center;justify-content:flex-start;gap:10px;padding:10px 12px;text-align:left}
.manual-lock-review .manual-lock-review-logo{width:34px;height:34px;flex:0 0 34px;object-fit:contain}
.manual-lock-review .manual-lock-review-fallback{display:grid;width:34px;height:34px;flex:0 0 34px;place-items:center;border-radius:50%;background:var(--surface-muted);font-size:13px;font-weight:900}
.manual-lock-review .manual-lock-pick-copy{display:flex;min-width:0;flex:1;align-items:baseline;gap:7px}
.manual-lock-review .manual-lock-pick-copy strong{min-width:0;overflow:hidden;color:var(--ink);font-size:14px;text-overflow:ellipsis;white-space:nowrap}
.manual-lock-review .manual-lock-pick-copy span{flex:0 0 auto;color:var(--ink);font-size:14px;font-weight:900}
.manual-lock-review .manual-lock-note{margin:9px 2px 12px;color:var(--muted);font-size:11px;font-weight:700;line-height:1.35;text-align:center}
.manual-lock-review .confirmation-actions{grid-template-columns:1fr 1fr}
.manual-lock-review .manual-lock-confirm-btn{color:var(--ink);background:var(--gold);border-color:#b88912}
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

function buildReviewLogo(card: HTMLElement, selectedTeam: string) {
  const image = card.querySelector<HTMLImageElement>(".team-logo");
  if (image?.src) {
    const logo = document.createElement("img");
    logo.className = "manual-lock-review-logo";
    logo.src = image.src;
    logo.alt = "";
    logo.width = 34;
    logo.height = 34;
    return logo;
  }
  const fallback = document.createElement("div");
  fallback.className = "manual-lock-review-fallback";
  fallback.textContent = selectedTeam.slice(0, 1);
  return fallback;
}

function openReview(card: HTMLElement, selectedTeam: string, spreadText: string, onConfirm: () => Promise<void>) {
  closeReview();
  const backdrop = document.createElement("div");
  backdrop.className = "confirmation-backdrop manual-lock-review-backdrop";

  const sheet = document.createElement("section");
  sheet.className = "confirmation-sheet manual-lock-review";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-labelledby", "manual-lock-title");

  const heading = document.createElement("div");
  heading.className = "confirmation-heading";
  const title = document.createElement("h2");
  title.id = "manual-lock-title";
  title.textContent = "Lock Pick";
  heading.appendChild(title);

  const matchup = document.createElement("div");
  matchup.className = "confirmation-matchup";
  const pickCell = document.createElement("div");
  pickCell.className = "manual-lock-pick-cell";
  pickCell.appendChild(buildReviewLogo(card, selectedTeam));
  const pickCopy = document.createElement("div");
  pickCopy.className = "manual-lock-pick-copy";
  const team = document.createElement("strong");
  team.textContent = selectedTeam;
  const spread = document.createElement("span");
  spread.textContent = spreadText;
  pickCopy.append(team, spread);
  pickCell.appendChild(pickCopy);
  matchup.appendChild(pickCell);

  const note = document.createElement("p");
  note.className = "manual-lock-note";
  note.textContent = "Locks this pick at this spread permanently. It cannot be changed or removed.";

  const actions = document.createElement("div");
  actions.className = "confirmation-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "btn secondary manual-lock-cancel";
  cancel.textContent = "Cancel";
  const confirm = document.createElement("button");
  confirm.type = "button";
  confirm.className = "btn manual-lock-confirm-btn";
  confirm.textContent = "Confirm lock";
  actions.append(cancel, confirm);

  sheet.append(heading, matchup, note, actions);
  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);

  cancel.addEventListener("click", closeReview);
  backdrop.addEventListener("click", (event) => { if (event.target === backdrop) closeReview(); });
  confirm.addEventListener("click", async () => {
    if (confirm.disabled) return;
    confirm.disabled = true;
    confirm.textContent = "Locking…";
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
            openReview(card, selectedTeam, spreadText, async () => {
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
