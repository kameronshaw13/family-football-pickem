"use client";

import { useEffect } from "react";
import type { AppSlug } from "@/lib/rulePresentation";

const APP_DATA_CACHE_PREFIX = "pickem_app_data_v1";
const FULL_GAME_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Chicago"
});

const STYLES = `
.manual-pick-lock{display:inline-flex;min-width:60px;height:28px;align-items:center;justify-content:center;gap:5px;padding:0 8px;border:1px solid #b88912;border-radius:4px;color:var(--ink);background:var(--gold);font-family:var(--font-display);font-size:10px;font-weight:900;line-height:1;cursor:pointer}
.manual-pick-lock svg{width:12px;height:12px;stroke-width:2.2;color:var(--ink)}
.manual-pick-lock:disabled{cursor:default;opacity:.55}
.manual-lock-confirmed{display:inline-flex;min-width:42px;height:28px;align-items:center;justify-content:center;color:var(--muted);font-size:9px;font-weight:800}
.manual-lock-toast{position:fixed;right:12px;bottom:calc(var(--nav-height) + env(safe-area-inset-bottom) + 12px);left:12px;z-index:65;display:flex;min-height:44px;align-items:center;justify-content:center;padding:9px 12px;border:1px solid var(--line-strong);border-radius:5px;background:var(--panel);box-shadow:var(--shadow);color:var(--ink);font-size:12px;font-weight:800;text-align:center}
.manual-lock-toast.error{color:var(--red)}
.manual-lock-review .confirmation-heading{margin-top:0;margin-bottom:0}
.manual-lock-review .confirmation-heading h2{margin:0}
.manual-lock-review .confirmation-matchup{grid-template-columns:1fr;margin-top:8px;border-block:1px solid var(--line-strong)}
.manual-lock-review .confirmation-matchup>div.manual-lock-pick-cell{display:grid;width:100%;height:var(--data-row-height);min-height:var(--data-row-height);grid-template-columns:38px minmax(0,1fr) 68px;align-items:center;gap:var(--space-3);padding:10px var(--pick-content-inset);border:0;color:var(--ink);background:var(--blue-soft);box-shadow:inset 4px 0 0 var(--blue);text-align:left;cursor:default;transition:none}
.manual-lock-review .manual-lock-pick-cell>.team-logo{width:34px;height:34px}
.manual-lock-review .manual-lock-pick-cell>.team-name{min-width:0;overflow:hidden;color:var(--ink);font-family:var(--font-display);font-size:16px;font-weight:700;line-height:1.2;text-overflow:ellipsis;text-transform:none;white-space:nowrap;-webkit-text-fill-color:var(--ink)}
.manual-lock-review .manual-lock-pick-cell>.team-spread{display:inline-flex;width:100%;align-items:center;justify-content:flex-end;color:var(--ink);font-family:var(--font-display);font-size:16px;font-weight:700;font-variant-numeric:tabular-nums;text-align:right;text-transform:none;white-space:nowrap;-webkit-text-fill-color:var(--ink)}
.manual-lock-review .confirmation-kickoff.manual-lock-meta{display:flex;min-height:30px;align-items:center;justify-content:center;margin:0;padding:5px 8px;border-bottom:1px solid var(--line-strong);color:var(--header-muted);background:var(--surface-muted);font-size:10px;font-weight:600;font-variant-numeric:tabular-nums;line-height:1.2;text-align:center}
.manual-lock-review .manual-lock-note{margin:8px 2px 12px;color:var(--muted);font-size:11px;font-weight:700;line-height:1.35;text-align:center}
.manual-lock-review .confirmation-actions{grid-template-columns:1fr 1fr}
.manual-lock-review .manual-lock-confirm-btn{display:flex;align-items:center;justify-content:center;color:var(--ink);background:var(--gold);border-color:#b88912}
`;

type CachedGame = {
  commence_time?: string | null;
  away_team?: string | null;
  home_team?: string | null;
};

type CachedSideBet = {
  offered_team?: string | null;
  creator_team?: string | null;
  game?: CachedGame | null;
};

type CachedPayload = {
  week?: number | null;
  games?: CachedGame[];
  sideBets?: CachedSideBet[];
};

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

function fullGameDate(iso: string) {
  return FULL_GAME_DATE_FORMATTER.format(new Date(iso));
}

function readCachedPayload(appSlug: AppSlug, week: number | null) {
  const keys = [
    `${APP_DATA_CACHE_PREFIX}:${appSlug}:${week == null ? "default" : week}`,
    `${APP_DATA_CACHE_PREFIX}:${appSlug}:default`
  ];
  for (const key of keys) {
    try {
      const stored = window.sessionStorage.getItem(key);
      if (!stored) continue;
      const entry = JSON.parse(stored) as { payload?: CachedPayload } | null;
      const payload = entry?.payload;
      if (!payload) continue;
      if (week != null && payload.week != null && Number(payload.week) !== week) continue;
      return payload;
    } catch {
      // Ignore stale cache entries and continue to the fallback key.
    }
  }
  return null;
}

function gameForSelectedTeam(appSlug: AppSlug, selectedTeam: string) {
  const week = selectedWeekFromHeader();
  const payload = readCachedPayload(appSlug, week);
  return payload?.games?.find((game) => game.away_team === selectedTeam || game.home_team === selectedTeam) || null;
}

function buildReviewLogo(card: HTMLElement, selectedTeam: string) {
  const image = card.querySelector<HTMLImageElement>(".team-logo");
  if (image?.src) {
    const logo = document.createElement("img");
    logo.className = "team-logo manual-lock-review-logo";
    logo.src = image.src;
    logo.alt = "";
    logo.width = 34;
    logo.height = 34;
    return logo;
  }
  const fallback = document.createElement("div");
  fallback.className = "team-logo fallback manual-lock-review-fallback";
  fallback.textContent = selectedTeam.slice(0, 1);
  return fallback;
}

function reviewTeamName(card: HTMLElement, selectedTeam: string) {
  const visible = card.querySelector<HTMLElement>(".pick-title-team")?.getAttribute("aria-label")?.trim()
    || card.querySelector<HTMLElement>(".pick-title-team .responsive-text-value")?.textContent?.trim()
    || card.querySelector<HTMLElement>(".pick-title-team")?.textContent?.trim();
  return visible || selectedTeam;
}

function reviewMatchup(card: HTMLElement) {
  const full = card.querySelector<HTMLElement>(".pick-meta .responsive-text")?.getAttribute("aria-label")
    || card.querySelector<HTMLElement>(".pick-meta")?.textContent
    || "";
  return full.split(" · ")[0]?.trim() || "";
}

function normalizeTeamText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function reviewRowTeam(row: Element | undefined) {
  if (!row) return "";
  const full = row.querySelector<HTMLElement>(".responsive-text")?.getAttribute("aria-label")
    || row.querySelector<HTMLElement>("strong")?.textContent
    || "";
  return full.replace(/\s(?:[+-]\d+(?:\.\d+)?|pk)\s*$/i, "").trim();
}

function teamLabelMatches(rawTeam: string | null | undefined, displayedTeam: string) {
  const raw = normalizeTeamText(rawTeam || "");
  const displayed = normalizeTeamText(displayedTeam);
  if (!raw || !displayed) return false;
  return raw === displayed || raw.startsWith(`${displayed} `) || raw.endsWith(` ${displayed}`) || raw.includes(displayed);
}

function enhanceSideBetConfirmationDate(appSlug: AppSlug) {
  const sheet = Array.from(document.querySelectorAll<HTMLElement>(".confirmation-sheet")).find((candidate) => {
    if (candidate.classList.contains("manual-lock-review")) return false;
    return /review side bet/i.test(candidate.querySelector<HTMLElement>(".confirmation-heading > span")?.textContent || "");
  });
  if (!sheet) return;
  const kickoff = sheet.querySelector<HTMLElement>(".confirmation-kickoff");
  if (!kickoff) return;
  const rows = Array.from(sheet.querySelectorAll(".confirmation-matchup > div"));
  const offeredTeam = reviewRowTeam(rows[0]);
  const creatorTeam = reviewRowTeam(rows[1]);
  if (!offeredTeam || !creatorTeam) return;

  const payload = readCachedPayload(appSlug, selectedWeekFromHeader());
  const bet = payload?.sideBets?.find((candidate) =>
    teamLabelMatches(candidate.offered_team, offeredTeam) && teamLabelMatches(candidate.creator_team, creatorTeam)
  );
  const commenceTime = bet?.game?.commence_time;
  if (!commenceTime) return;
  const nextText = fullGameDate(commenceTime);
  if (kickoff.textContent?.trim() !== nextText) kickoff.textContent = nextText;
}

function openReview(appSlug: AppSlug, card: HTMLElement, selectedTeam: string, spreadText: string, onConfirm: () => Promise<void>) {
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
  pickCell.className = "team-row picked-side manual-lock-pick-cell";
  const team = document.createElement("span");
  team.className = "team-name";
  team.textContent = reviewTeamName(card, selectedTeam);
  const spread = document.createElement("span");
  spread.className = "team-spread";
  spread.textContent = spreadText;
  pickCell.append(buildReviewLogo(card, selectedTeam), team, spread);
  matchup.appendChild(pickCell);

  const meta = document.createElement("p");
  meta.className = "confirmation-kickoff manual-lock-meta";
  const game = gameForSelectedTeam(appSlug, selectedTeam);
  meta.textContent = [reviewMatchup(card), game?.commence_time ? fullGameDate(game.commence_time) : ""].filter(Boolean).join(" · ");

  const note = document.createElement("p");
  note.className = "manual-lock-note";
  note.textContent = "Locks only this pick at this spread permanently. Your other unlocked picks can still be changed.";

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

  sheet.append(heading, matchup);
  if (meta.textContent) sheet.appendChild(meta);
  sheet.append(note, actions);
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
        enhanceSideBetConfirmationDate(appSlug);
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
            openReview(appSlug, card, selectedTeam, spreadText, async () => {
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
                showMessage(`${reviewTeamName(card, selectedTeam)} locked at the current spread.`);
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
