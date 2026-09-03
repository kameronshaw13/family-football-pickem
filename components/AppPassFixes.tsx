"use client";

import { useEffect } from "react";
import type { AppSlug } from "@/lib/rulePresentation";

const APP_DATA_CACHE_PREFIX = "pickem_app_data_v1";

const STYLES = `
/* Keep a locked pick in the same 30px action slot previously occupied by the remove X. */
.pick-lock-indicator{display:grid!important;width:30px!important;min-width:30px!important;height:30px!important;min-height:30px!important;place-items:center!important;padding:0!important;border:0!important;border-radius:0!important;color:var(--muted)!important;background:transparent!important;box-shadow:none!important;font-size:0!important;line-height:1!important}
.pick-lock-indicator svg{display:block;width:18px;height:18px;stroke:currentColor;stroke-width:2;fill:none}
.pick-lock-indicator.app-pass-lock-hidden{display:none!important}

/* An empty League Card row must start immediately below the player header. */
.card-panel .group-card>h3+.group-empty-picks,.card-panel .group-card>h3+.admin-no-submission-row{margin-top:0!important}
.card-panel .group-card>h3+.group-empty-picks{border-top:0!important;background:var(--panel)!important;box-shadow:none!important}
.card-panel .group-card>h3+.admin-no-submission-row{border-top:0!important;background:var(--panel)!important;box-shadow:none!important}
.card-panel .group-card>h3+.admin-no-submission-row::before{display:none!important}

/* Standings numbers use the same natural, unpadded line box as Bank values. */
.leaderboard-row>.leaderboard-rank,.leaderboard-row>.leaderboard-stat,.leaderboard-row>.leaderboard-pct,.leaderboard-row>.leaderboard-points{line-height:normal!important;overflow:visible!important}
.leaderboard-row>.leaderboard-rank .numeric-token,.leaderboard-row>.leaderboard-rank .numeric-fragment,.leaderboard-row>.leaderboard-stat .numeric-token,.leaderboard-row>.leaderboard-stat .numeric-fragment,.leaderboard-row>.leaderboard-pct .numeric-token,.leaderboard-row>.leaderboard-pct .numeric-fragment,.leaderboard-row>.leaderboard-points .numeric-token,.leaderboard-row>.leaderboard-points .numeric-fragment{display:inline;line-height:inherit!important;overflow:visible!important;padding-bottom:0!important}

/* The Place value and player name share identical type metrics, so flex centering aligns their visible centers. */
.leaderboard-row>.leaderboard-rank,.leaderboard-row>.leaderboard-player>strong{font-size:14px!important;font-weight:700!important;line-height:normal!important}
.leaderboard-labels>span:first-child,.leaderboard-row>.leaderboard-rank{justify-content:center!important;padding-left:0!important;text-align:center!important}
.leaderboard-row>.leaderboard-rank{width:100%}
.standings-panel .leaderboard-player .player-profile-link{text-decoration:none!important}

/* Pending Offers use the same natural, unpadded single-line treatment as working pick titles. */
.side-bet-offer-copy>strong{overflow:clip!important;overflow-clip-margin:2px;line-height:normal!important}
.side-bet-offer-copy>strong .responsive-text,.side-bet-offer-copy>strong .responsive-text-value{line-height:inherit!important;overflow:clip!important;overflow-clip-margin:2px}
.side-bet-offer-copy>strong .numeric-token,.side-bet-offer-copy>strong .numeric-fragment{display:inline;line-height:inherit!important;overflow:visible!important;padding-bottom:0!important}
.bank-game-result .bank-game-pick-title{overflow:clip!important;overflow-clip-margin:2px;line-height:1.3!important}
.bank-game-result .bank-game-pick-title .pick-title-market,.bank-game-result .bank-game-pick-title .numeric-token,.bank-game-result .bank-game-pick-title .numeric-fragment{line-height:inherit!important;overflow:visible!important}
.bank-game-result .bank-game-pick-title .pick-title-market>.numeric-token{display:inline-block;padding-bottom:1px}
.game-time,.game-final-status,.game-live-status,.game-live-situation{line-height:1.3!important;overflow:visible!important}
.game-time .numeric-token,.game-time .numeric-fragment,.game-final-status .numeric-token,.game-final-status .numeric-fragment,.game-live-status .numeric-token,.game-live-status .numeric-fragment,.game-live-situation .numeric-token,.game-live-situation .numeric-fragment{line-height:inherit!important;overflow:visible!important}
.pick-meta,.visible-pick-copy>p{overflow:clip!important;overflow-clip-margin:2px;line-height:1.4!important}
.pick-meta .responsive-text,.pick-meta .responsive-text-value,.visible-pick-copy>p .responsive-text,.visible-pick-copy>p .responsive-text-value{overflow:clip!important;overflow-clip-margin:2px;line-height:1.4!important}

/* A completed week has history only and no new-offer controls. */
.side-bet-center.app-pass-week-complete .side-bet-list-section[aria-labelledby="pending-offers-title"]{display:none!important}
.side-bet-center.app-pass-week-complete .side-bet-filter-row.make-offer{grid-template-columns:minmax(0,120px)!important}
.side-bet-center.app-pass-week-complete .side-bet-filter-row.make-offer>.compact-select:not(:first-child){display:none!important}
.side-bet-center.app-pass-week-complete .side-bet-sportsbook-board>:not(.app-pass-week-complete-message){display:none!important}
.side-bet-center.app-pass-week-complete .side-bet-slip-bar,.side-bet-center.app-pass-week-complete .side-bet-slip-sheet{display:none!important}
`;

type CachedGame = {
  id?: string;
  week?: number;
  league?: "CFB" | "NFL";
  commence_time?: string | null;
  lock_time?: string | null;
  is_locked?: boolean;
  final_home_score?: number | null;
  final_away_score?: number | null;
  live_completed?: boolean | null;
  live_state?: string | null;
};

type CachedPick = {
  user_id?: string;
  game_id?: string;
  week?: number;
  pick_type?: "regular" | "underdog";
  status?: "draft" | "locked";
};

type CachedWeekRule = {
  phase?: "opening" | "college" | "mixed" | "nfl";
  regularTotal?: number;
  cfbMinimum?: number;
  nflMinimum?: number;
  underdogTotal?: number;
};

type CachedPayload = {
  week?: number;
  currentUser?: { id?: string } | null;
  games?: CachedGame[];
  picks?: CachedPick[];
  weekRule?: CachedWeekRule | null;
};

function selectedWeekFromHeader() {
  const text = document.querySelector<HTMLElement>(".week-select-wrap .custom-select-trigger")?.textContent || "";
  const match = text.match(/Week\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function readCachedPayload(appSlug: AppSlug, week: number | null) {
  const keys = [
    `${APP_DATA_CACHE_PREFIX}:${appSlug}:${week == null ? "default" : week}`,
    `${APP_DATA_CACHE_PREFIX}:${appSlug}:default`
  ];
  for (const key of keys) {
    try {
      const raw = window.sessionStorage.getItem(key);
      if (!raw) continue;
      const entry = JSON.parse(raw) as { payload?: CachedPayload } | null;
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

function lockIconMarkup() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke-linecap="round"/></svg>`;
}

function unlockIconMarkup() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.8-1.3" stroke-linecap="round"/></svg>`;
}

function gameIsFinal(game: CachedGame) {
  return (game.final_away_score != null && game.final_home_score != null) || Boolean(game.live_completed) || game.live_state === "post";
}

function universalWeekendLockTime(games: CachedGame[]) {
  const candidates = games.flatMap((game) => {
    if (!game.lock_time || !game.commence_time) return [];
    const lock = new Date(game.lock_time).getTime();
    const kickoff = new Date(game.commence_time).getTime();
    if (!Number.isFinite(lock) || !Number.isFinite(kickoff) || lock >= kickoff - 60_000) return [];
    return [lock];
  });
  return candidates.length ? Math.min(...candidates) : null;
}

function pickIsLocked(pick: CachedPick, gamesById: Map<string, CachedGame>, now: number) {
  if (pick.status === "locked") return true;
  const game = pick.game_id ? gamesById.get(pick.game_id) : undefined;
  if (!game) return false;
  if (game.is_locked) return true;
  const lock = game.lock_time ? new Date(game.lock_time).getTime() : Number.NaN;
  return Number.isFinite(lock) && lock <= now;
}

function enhanceLockIndicator(element: HTMLElement, universalLockReached: boolean, locked: boolean) {
  element.classList.add("pick-lock-indicator");
  element.classList.toggle("app-pass-lock-hidden", universalLockReached);
  element.setAttribute("aria-label", locked ? "Locked" : "Unlocked");
  const iconState = locked ? "locked" : "unlocked";
  if (element.dataset.appPassLockIcon !== iconState) {
    element.dataset.appPassLockIcon = iconState;
    element.innerHTML = locked ? lockIconMarkup() : unlockIconMarkup();
  }
}

function progressCheckMarkup() {
  return `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.8 10a10 10 0 1 1-4.8-6.7"/><path d="m9 11 3 3L22 4"/></svg>`;
}

function syncPartialLockProgress(payload: CachedPayload | null, games: CachedGame[], week: number | null, universalLockReached: boolean, now: number) {
  const panel = document.querySelector<HTMLElement>(".card-panel");
  const pickSection = panel?.querySelector<HTMLElement>(":scope>.pick-section");
  const fallback = panel?.querySelector<HTMLElement>('[data-app-pass-progress="1"]');
  if (!panel || !pickSection || !payload?.currentUser?.id || !payload.weekRule) {
    fallback?.remove();
    return;
  }

  const nativeProgress = panel.querySelector<HTMLElement>(".card-progress:not([data-app-pass-progress])");
  if (nativeProgress || universalLockReached) {
    fallback?.remove();
    return;
  }

  const currentWeek = week ?? payload.week;
  const picks = (payload.picks || []).filter((pick) => pick.user_id === payload.currentUser?.id && (currentWeek == null || pick.week == null || Number(pick.week) === currentWeek));
  const regularTotal = Number(payload.weekRule.regularTotal || 0);
  const underdogTotal = Number(payload.weekRule.underdogTotal ?? 1);
  const requiredTotal = regularTotal + underdogTotal;
  const gamesById = new Map(games.flatMap((game) => game.id ? [[game.id, game] as const] : []));
  const allRequiredLocked = requiredTotal > 0 && picks.length === requiredTotal && picks.every((pick) => pickIsLocked(pick, gamesById, now));
  if (allRequiredLocked) {
    fallback?.remove();
    return;
  }

  // The native component is only absent here because every currently submitted pick is locked.
  // Restore the exact progress-card structure until the full card or shared weekend lock is complete.
  const regular = picks.filter((pick) => pick.pick_type === "regular");
  const cfb = regular.filter((pick) => pick.game_id && gamesById.get(pick.game_id)?.league === "CFB").length;
  const nfl = regular.filter((pick) => pick.game_id && gamesById.get(pick.game_id)?.league === "NFL").length;
  const hasDog = picks.some((pick) => pick.pick_type === "underdog");
  const completeSlots = Math.min(regular.length + Number(hasDog), Math.max(requiredTotal, 1));
  const progress = requiredTotal > 0 ? completeSlots / requiredTotal * 100 : 0;
  const cardComplete = regular.length === regularTotal && cfb >= Number(payload.weekRule.cfbMinimum || 0) && nfl >= Number(payload.weekRule.nflMinimum || 0) && (underdogTotal === 0 || hasDog);
  const countText = payload.weekRule.phase === "opening" || payload.weekRule.phase === "college"
    ? `${cfb}/${regularTotal} CFB spreads · dog ${hasDog ? "set" : "open"}`
    : `${regular.length}/${regularTotal} spreads · ${cfb} CFB · ${nfl} NFL · dog ${hasDog ? "set" : "open"}`;

  const progressCard = fallback || document.createElement("div");
  progressCard.dataset.appPassProgress = "1";
  progressCard.className = `card-progress${cardComplete ? " complete" : ""}`;
  if (!fallback) {
    progressCard.innerHTML = `<div class="card-progress-copy"><div class="card-progress-heading"><strong></strong><span class="card-progress-state saved">${progressCheckMarkup()}Picks saved</span></div><span class="card-progress-count"></span></div><div class="progress-track" aria-hidden="true"><span></span></div>`;
    panel.insertBefore(progressCard, pickSection);
  }
  const heading = progressCard.querySelector<HTMLElement>(".card-progress-heading>strong");
  const count = progressCard.querySelector<HTMLElement>(".card-progress-count");
  const bar = progressCard.querySelector<HTMLElement>(".progress-track>span");
  const headingText = cardComplete ? "Card complete" : "Build your card";
  if (heading && heading.textContent !== headingText) heading.textContent = headingText;
  if (count && count.textContent !== countText) count.textContent = countText;
  if (bar) bar.style.width = `${progress}%`;
}

function syncCompletedWeek(center: HTMLElement | null, complete: boolean) {
  if (!center) return;
  center.classList.toggle("app-pass-week-complete", complete);
  const board = center.querySelector<HTMLElement>(".side-bet-sportsbook-board");
  let message = center.querySelector<HTMLElement>(".app-pass-week-complete-message");
  if (!complete) {
    message?.remove();
    return;
  }
  if (board && !message) {
    message = document.createElement("div");
    message.className = "empty-state side-bet-empty-state app-pass-week-complete-message";
    message.textContent = "Week is complete";
    board.appendChild(message);
  }
}

export default function AppPassFixes({ appSlug }: { appSlug: AppSlug }) {
  useEffect(() => {
    let applying = false;
    let frame = 0;

    const apply = () => {
      if (applying) return;
      applying = true;
      try {
        const week = selectedWeekFromHeader();
        const payload = readCachedPayload(appSlug, week);
        const games = (payload?.games || []).filter((game) => week == null || game.week == null || Number(game.week) === week);
        const now = Date.now();
        const universalLock = universalWeekendLockTime(games);
        const universalLockReached = universalLock != null && universalLock <= now;

        document.querySelectorAll<HTMLElement>(".pick-status-locked,.manual-lock-confirmed").forEach((element) => enhanceLockIndicator(element, universalLockReached, true));
        document.querySelectorAll<HTMLElement>(".pick-status-unlocked").forEach((element) => enhanceLockIndicator(element, universalLockReached, false));

        document.querySelectorAll<HTMLElement>(".pick-card,.visible-pick,.bank-game-result").forEach((row) => {
          const admin = Boolean(row.querySelector('img[src*="admin-no-submission.svg"]'));
          row.classList.toggle("admin-no-submission-row", admin);
        });

        syncPartialLockProgress(payload, games, week, universalLockReached, now);

        const weekComplete = games.length > 0 && games.every(gameIsFinal);
        syncCompletedWeek(document.querySelector<HTMLElement>(".side-bet-center"), weekComplete);
      } finally {
        applying = false;
      }
    };

    const scheduleApply = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        apply();
      });
    };

    apply();
    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const timer = window.setInterval(apply, 30_000);
    void document.fonts?.ready.then(scheduleApply).catch(() => undefined);
    window.addEventListener("storage", scheduleApply);

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("storage", scheduleApply);
      document.querySelector('[data-app-pass-progress="1"]')?.remove();
      document.querySelector(".app-pass-week-complete-message")?.remove();
    };
  }, [appSlug]);

  return <style>{STYLES}</style>;
}
