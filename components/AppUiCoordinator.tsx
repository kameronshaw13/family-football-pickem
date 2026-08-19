"use client";

import { useEffect } from "react";

type UiGame = {
  id: string;
  week: number;
  commence_time: string;
  away_team: string;
  home_team: string;
  away_logo_url?: string | null;
  home_logo_url?: string | null;
};

type UiTarget = {
  recipient_id: string;
  response: string;
  recipient?: { display_name?: string | null } | null;
};

type UiBet = {
  id: string;
  week: number;
  creator_id: string;
  creator_team: string;
  offered_team: string;
  creator_spread: number | string;
  offered_spread: number | string;
  amount: number | string;
  status: string;
  accepted_by?: string | null;
  created_at?: string | null;
  creator?: { display_name?: string | null } | null;
  accepted_by_profile?: { display_name?: string | null } | null;
  targets?: UiTarget[];
  game?: UiGame | null;
};

type UiPayload = {
  currentUser?: { id: string; display_name?: string | null };
  week?: number;
  games?: UiGame[];
  sideBets?: UiBet[];
};

type CacheEntry = { cachedAt?: number; payload?: UiPayload };

const CACHE_PREFIX = "pickem_app_data_v1:";
const preloadImages = new Map<string, HTMLImageElement>();
const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Chicago" });
const FULL_DATE = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "America/Chicago" });
const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

function selectedWeek() {
  const trigger = document.querySelector<HTMLButtonElement>('button[aria-label="Select week"]');
  const match = (trigger?.textContent || "").match(/Week\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function cachedPayload() {
  const week = selectedWeek();
  let best: { cachedAt: number; payload: UiPayload } | null = null;
  try {
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (!key?.startsWith(CACHE_PREFIX)) continue;
      const entry = JSON.parse(window.sessionStorage.getItem(key) || "null") as CacheEntry | null;
      if (!entry?.payload) continue;
      if (week != null && Number(entry.payload.week) !== week) continue;
      const cachedAt = Number(entry.cachedAt || 0);
      if (!best || cachedAt > best.cachedAt) best = { cachedAt, payload: entry.payload };
    }
  } catch {
    return null;
  }
  return best?.payload || null;
}

function normalizeUrl(value?: string | null) {
  if (!value) return "";
  try { return new URL(value, window.location.origin).href; }
  catch { return value; }
}

function spreadText(value: number | string) {
  const spread = Number(value);
  if (!Number.isFinite(spread)) return "";
  if (spread === 0) return "Pick'em";
  return `${spread > 0 ? "+" : ""}${spread}`;
}

function kickoffText(iso: string) {
  return `${WEEKDAY.format(new Date(iso)).slice(0, 3)} ${TIME.format(new Date(iso))}`;
}

function removeSpread(value: string) {
  return value
    .replace(/\s(?:[+-]\d+(?:\.\d+)?|Pick'em)(?=\s|$)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchupNames(card: HTMLElement | null, bet: UiBet) {
  const title = card?.querySelector<HTMLElement>(".side-bet-offer-copy > strong")?.textContent?.trim() || "";
  const clean = removeSpread(title);
  const pieces = clean.split(/\s+at\s+/i);
  if (pieces.length === 2) return { away: pieces[0].trim(), home: pieces[1].trim() };
  return { away: bet.game?.away_team || "Away", home: bet.game?.home_team || "Home" };
}

function displaySideName(card: HTMLElement | null, bet: UiBet, team: string) {
  const names = matchupNames(card, bet);
  return team === bet.game?.home_team ? names.home : names.away;
}

function logoForTeam(bet: UiBet, team: string) {
  if (!bet.game) return null;
  return team === bet.game.home_team ? bet.game.home_logo_url || null : bet.game.away_logo_url || null;
}

function currentSideBetView() {
  const trigger = document.querySelector<HTMLButtonElement>('button[aria-label="Choose side bet view"]');
  const text = trigger?.textContent?.trim() || "";
  if (/Sent/i.test(text)) return "sent" as const;
  if (/Make Offer/i.test(text)) return "new" as const;
  return "received" as const;
}

function sortedBets(payload: UiPayload, mode: "received" | "sent") {
  const userId = payload.currentUser?.id;
  if (!userId) return [];
  const week = Number(payload.week ?? selectedWeek() ?? 0);
  return (payload.sideBets || [])
    .filter((bet) => Number(bet.week) === week)
    .filter((bet) => mode === "sent"
      ? bet.creator_id === userId
      : bet.creator_id !== userId && bet.targets?.some((target) => target.recipient_id === userId))
    .sort((a, b) => Number(b.status === "open") - Number(a.status === "open") || new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
}

function statusForBet(bet: UiBet, userId: string) {
  const declined = bet.targets?.find((target) => target.response === "declined");
  const creatorName = bet.creator?.display_name || "A player";
  const you = (id: string | null | undefined, name: string) => id === userId ? "You" : name;
  if (bet.accepted_by) return { action: "Accepted", actor: you(bet.accepted_by, bet.accepted_by_profile?.display_name || "Player"), tone: "accepted" };
  if (declined || bet.status === "declined") return { action: "Declined", actor: declined ? you(declined.recipient_id, declined.recipient?.display_name || "Player") : "You", tone: "declined" };
  if (bet.status === "cancelled") return { action: "Cancelled", actor: you(bet.creator_id, creatorName), tone: "declined" };
  if (bet.status === "expired") return { action: "Expired", actor: "Offer", tone: "declined" };
  return { action: "Offered", actor: you(bet.creator_id, creatorName), tone: "pending" };
}

function replaceSelfText(root: HTMLElement, displayName: string) {
  if (!displayName) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeValue?.includes(displayName)) node.nodeValue = node.nodeValue.replaceAll(displayName, "You");
    node = walker.nextNode();
  }
}

function enhanceSideBetCard(card: HTMLElement, bet: UiBet, mode: "received" | "sent", payload: UiPayload) {
  card.dataset.sideBetId = bet.id;
  const userId = payload.currentUser?.id || "";
  const displayTeam = mode === "received" ? bet.offered_team : bet.creator_team;
  const displaySpread = mode === "received" ? bet.offered_spread : bet.creator_spread;
  const names = matchupNames(card, bet);
  const sideName = displaySideName(card, bet, displayTeam);
  const title = displayTeam === bet.game?.away_team
    ? `${names.away} ${spreadText(displaySpread)} at ${names.home}`
    : `${names.away} at ${names.home} ${spreadText(displaySpread)}`;
  const titleNode = card.querySelector<HTMLElement>(".side-bet-offer-copy > strong");
  if (titleNode) titleNode.textContent = title;

  const logo = card.querySelector<HTMLImageElement>(".side-bet-offer-row > img.team-logo");
  const nextLogo = logoForTeam(bet, displayTeam);
  if (logo && nextLogo && normalizeUrl(logo.src) !== normalizeUrl(nextLogo)) logo.src = nextLogo;
  if (logo) {
    logo.loading = "eager";
    void logo.decode?.().catch(() => undefined);
  }

  const paragraph = card.querySelector<HTMLElement>(".side-bet-offer-copy > p");
  if (!paragraph) return;
  const status = statusForBet(bet, userId);
  const renderedAction = paragraph.querySelector<HTMLElement>(".side-bet-response")?.textContent?.trim() || "";
  if (renderedAction && renderedAction !== status.action) {
    replaceSelfText(paragraph, payload.currentUser?.display_name || "");
    return;
  }

  paragraph.replaceChildren();
  paragraph.append(document.createTextNode(`${status.actor} `));
  const action = document.createElement("span");
  action.className = `side-bet-response ${status.tone}`;
  action.textContent = status.action;
  paragraph.append(action);
  paragraph.append(document.createTextNode(` ${sideName} ${spreadText(displaySpread)}`));
  if (bet.game?.commence_time) paragraph.append(document.createTextNode(` · ${kickoffText(bet.game.commence_time)}`));
}

function enhanceSideBets(payload: UiPayload) {
  const mode = currentSideBetView();
  if (mode === "new") {
    document.querySelectorAll<HTMLImageElement>(".side-bet-center img.team-logo").forEach((logo) => {
      logo.loading = "eager";
      void logo.decode?.().catch(() => undefined);
    });
    return;
  }
  const bets = sortedBets(payload, mode);
  const cards = Array.from(document.querySelectorAll<HTMLElement>(`.side-bet-card.mode-${mode}`));
  cards.forEach((card, index) => {
    const knownId = card.dataset.sideBetId;
    const bet = knownId ? bets.find((item) => item.id === knownId) : bets[index];
    if (bet) enhanceSideBetCard(card, bet, mode, payload);
  });
}

function makeSeasonNamesInteractive() {
  const heading = Array.from(document.querySelectorAll<HTMLElement>(".standings-panel .scoreboard-heading h2"))
    .find((node) => node.textContent?.trim() === "Season Standings");
  const leaderboard = heading?.closest(".scoreboard-heading")?.nextElementSibling;
  if (!(leaderboard instanceof HTMLElement) || !leaderboard.classList.contains("leaderboard")) return;
  leaderboard.querySelectorAll<HTMLElement>(".leaderboard-player strong").forEach((name) => {
    name.classList.add("player-profile-link");
    name.dataset.playerProfileName = name.textContent?.trim() || "";
    name.setAttribute("role", "button");
    name.setAttribute("tabindex", "0");
    name.setAttribute("aria-label", `Open ${name.dataset.playerProfileName || "player"} profile`);
  });
}

function removeSecondaryWeekControls() {
  for (const ariaLabel of ["Select standings week", "Select Bank results week", "Select side bet ledger week"]) {
    const trigger = document.querySelector<HTMLButtonElement>(`button[aria-label="${ariaLabel}"]`);
    trigger?.closest(".custom-select")?.remove();
  }
}

function filterLedger(payload: UiPayload) {
  if (document.querySelector(".test-mode-banner")) return;
  const list = document.querySelector<HTMLElement>(".standings-panel .ledger-list");
  if (!list) return;
  const week = Number(payload.week ?? selectedWeek() ?? 0);
  const settled = (payload.sideBets || []).filter((bet) => bet.status === "settled");
  const rows = Array.from(list.querySelectorAll<HTMLElement>(":scope > .side-bet-ledger-row"));
  rows.forEach((row, index) => {
    if (!row.dataset.sideBetId && settled[index]) row.dataset.sideBetId = settled[index].id;
    const bet = settled.find((item) => item.id === row.dataset.sideBetId);
    if (bet && Number(bet.week) !== week) row.remove();
  });
  const matches = settled.filter((bet) => Number(bet.week) === week);
  const empty = list.querySelector<HTMLElement>(":scope > p.muted");
  if (matches.length === 0) {
    if (empty) empty.textContent = "No settled side bets.";
    else {
      const message = document.createElement("p");
      message.className = "muted";
      message.textContent = "No settled side bets.";
      list.appendChild(message);
    }
  } else {
    empty?.remove();
  }
}

function myCardIsActive() {
  const panel = document.querySelector<HTMLElement>(".card-panel");
  return panel?.querySelector<HTMLElement>(".section-tabs button.active")?.textContent?.includes("My Card") ?? false;
}

function applyCardOrder(payload: UiPayload) {
  if (!myCardIsActive() || document.querySelector(".test-mode-banner")) return;
  const section = document.querySelector<HTMLElement>(".card-panel .pick-section");
  if (!section) return;
  const games = payload.games || [];
  Array.from(section.querySelectorAll<HTMLElement>(":scope > .pick-card")).forEach((card, index) => {
    const isDog = card.textContent?.includes("Dog") ?? false;
    const logo = card.querySelector<HTMLImageElement>("img.team-logo");
    const logoUrl = normalizeUrl(logo?.src);
    const game = games.find((item) => [item.away_logo_url, item.home_logo_url].some((url) => normalizeUrl(url) === logoUrl));
    const kickoff = game ? new Date(game.commence_time).getTime() : Number.MAX_SAFE_INTEGER - 1000 + index;
    card.style.order = String(isDog ? Number.MAX_SAFE_INTEGER : kickoff);
  });
}

function preloadOpenGameLogos(payload: UiPayload) {
  for (const game of payload.games || []) {
    for (const url of [game.away_logo_url, game.home_logo_url]) {
      if (!url || preloadImages.has(url)) continue;
      const image = new Image();
      image.src = url;
      preloadImages.set(url, image);
      void image.decode?.().catch(() => undefined);
    }
  }
}

function findBet(payload: UiPayload, id: string) {
  return (payload.sideBets || []).find((bet) => bet.id === id) || null;
}

function reviewTeamRow(row: HTMLElement, label: string, bet: UiBet, team: string, spread: number | string, card: HTMLElement | null) {
  row.className = "confirmation-team-row";
  row.replaceChildren();
  const labelNode = document.createElement("span");
  labelNode.textContent = label;
  row.append(labelNode);
  const url = logoForTeam(bet, team);
  if (url) {
    const logo = document.createElement("img");
    logo.className = "confirmation-team-logo";
    logo.src = url;
    logo.alt = "";
    logo.width = 32;
    logo.height = 32;
    row.append(logo);
  } else {
    const fallback = document.createElement("span");
    fallback.className = "confirmation-team-logo confirmation-team-logo-fallback";
    fallback.textContent = displaySideName(card, bet, team).slice(0, 1);
    row.append(fallback);
  }
  const value = document.createElement("strong");
  value.textContent = `${displaySideName(card, bet, team)} ${spreadText(spread)}`;
  row.append(value);
}

function enhanceReviewModal(payload: UiPayload, reviewBetId: string) {
  if (!reviewBetId) return;
  const bet = findBet(payload, reviewBetId);
  const sheet = document.querySelector<HTMLElement>(".confirmation-sheet");
  if (!bet || !sheet) return;
  const card = document.querySelector<HTMLElement>(`.side-bet-card[data-side-bet-id="${CSS.escape(reviewBetId)}"]`);
  const heading = sheet.querySelector<HTMLElement>(".confirmation-heading h2");
  if (heading) heading.textContent = "Review Bet";
  let amountRow = sheet.querySelector<HTMLElement>(".confirmation-amount-row");
  if (!amountRow) {
    amountRow = document.createElement("div");
    amountRow.className = "confirmation-amount-row";
    const label = document.createElement("span");
    label.textContent = "Amount";
    const amount = document.createElement("strong");
    amount.textContent = `$${Math.abs(Number(bet.amount)).toFixed(Number.isInteger(Number(bet.amount)) ? 0 : 2)}`;
    amountRow.append(label, amount);
    sheet.querySelector(".confirmation-heading")?.insertAdjacentElement("afterend", amountRow);
  }
  const rows = Array.from(sheet.querySelectorAll<HTMLElement>(".confirmation-matchup > div"));
  if (rows[0]) reviewTeamRow(rows[0], "You get", bet, bet.offered_team, bet.offered_spread, card);
  if (rows[1]) reviewTeamRow(rows[1], `${bet.creator?.display_name || "Opponent"} gets`, bet, bet.creator_team, bet.creator_spread, card);
  if (bet.game) {
    const names = matchupNames(card, bet);
    const kickoff = sheet.querySelector<HTMLElement>(".confirmation-kickoff");
    if (kickoff) kickoff.textContent = `${FULL_DATE.format(new Date(bet.game.commence_time))} · ${TIME.format(new Date(bet.game.commence_time))} · ${names.away} at ${names.home}`;
  }
}

export default function AppUiCoordinator() {
  useEffect(() => {
    let active = true;
    let reviewBetId = "";
    const timers = new Set<number>();

    function run() {
      if (!active) return;
      const payload = cachedPayload();
      removeSecondaryWeekControls();
      makeSeasonNamesInteractive();
      if (!payload) return;
      applyCardOrder(payload);
      filterLedger(payload);
      enhanceSideBets(payload);
      enhanceReviewModal(payload, reviewBetId);
    }

    function schedule(delay = 0) {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        run();
      }, delay);
      timers.add(timer);
    }

    function scheduleBurst() {
      for (const delay of [0, 80, 300, 800, 1500]) schedule(delay);
    }

    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const reviewButton = target.closest<HTMLButtonElement>(".side-bet-card.mode-received .actions .btn.accept");
      if (reviewButton) {
        reviewBetId = reviewButton.closest<HTMLElement>(".side-bet-card")?.dataset.sideBetId || "";
      }
      const relevant = target.closest(".primary-nav button, .section-tabs button, .custom-select-option, .side-bet-card .actions button, .confirmation-actions button");
      if (!relevant) return;
      const label = relevant.textContent?.trim() || "";
      if (/Side Bets|Make Offer/i.test(label)) {
        const payload = cachedPayload();
        if (payload) preloadOpenGameLogos(payload);
      }
      scheduleBurst();
    }

    function onKey(event: KeyboardEvent) {
      if (!['Enter', ' '].includes(event.key)) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.classList.contains("player-profile-link")) target.click();
    }

    const onFocus = () => scheduleBurst();
    const onVisibility = () => { if (document.visibilityState === "visible") scheduleBurst(); };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    scheduleBurst();

    return () => {
      active = false;
      timers.forEach((timer) => window.clearTimeout(timer));
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  return null;
}
