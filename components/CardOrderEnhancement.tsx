"use client";

import { useEffect } from "react";

type CardGame = {
  id: string;
  commence_time: string;
  away_team: string;
  home_team: string;
  away_logo_url?: string | null;
  home_logo_url?: string | null;
};

type CardPick = {
  id: string;
  user_id: string;
  game_id: string;
  selected_team: string;
  pick_type: "regular" | "underdog";
  game?: CardGame | null;
};

type CardPayload = {
  currentUser?: { id: string };
  week?: number;
  picks?: CardPick[];
  games?: CardGame[];
};

function myCardIsActive() {
  const panel = document.querySelector<HTMLElement>(".card-panel");
  if (!panel) return false;
  const active = panel.querySelector<HTMLElement>(".section-tabs button.active");
  return active?.textContent?.includes("My Card") ?? false;
}

function selectedWeek() {
  const trigger = document.querySelector<HTMLButtonElement>('button[aria-label="Select week"]');
  const label = trigger?.textContent?.trim() || "";
  const match = label.match(/Week\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function normalizeUrl(value?: string | null) {
  if (!value) return "";
  try {
    return new URL(value, window.location.origin).href;
  } catch {
    return value;
  }
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function gameForPick(payload: CardPayload, pick: CardPick) {
  return pick.game || payload.games?.find((game) => game.id === pick.game_id) || null;
}

function logoForPick(payload: CardPayload, pick: CardPick) {
  const game = gameForPick(payload, pick);
  if (!game) return "";
  return normalizeUrl(pick.selected_team === game.home_team ? game.home_logo_url : game.away_logo_url);
}

function cardMatchesPick(card: HTMLElement, payload: CardPayload, pick: CardPick) {
  const img = card.querySelector<HTMLImageElement>("img.team-logo");
  const expectedLogo = logoForPick(payload, pick);
  if (img && expectedLogo && normalizeUrl(img.src) === expectedLogo) return true;

  const shown = normalizeText(card.querySelector<HTMLElement>(".pick-title-team")?.textContent || "");
  const raw = normalizeText(pick.selected_team);
  return Boolean(shown && raw && (raw.includes(shown) || shown.includes(raw)));
}

function applyOrder(payload: CardPayload) {
  if (!myCardIsActive() || !payload.currentUser) return;
  const section = document.querySelector<HTMLElement>(".card-panel .pick-section");
  if (!section) return;

  const picks = (payload.picks || []).filter((pick) => pick.user_id === payload.currentUser?.id);
  const sorted = [...picks].sort((a, b) => {
    if (a.pick_type !== b.pick_type) return a.pick_type === "underdog" ? 1 : -1;
    const gameA = gameForPick(payload, a);
    const gameB = gameForPick(payload, b);
    return new Date(gameA?.commence_time || 0).getTime() - new Date(gameB?.commence_time || 0).getTime();
  });
  const order = new Map(sorted.map((pick, index) => [pick.id, index]));
  const used = new Set<string>();

  Array.from(section.querySelectorAll<HTMLElement>(":scope > .pick-card")).forEach((card, index) => {
    const match = sorted.find((pick) => !used.has(pick.id) && cardMatchesPick(card, payload, pick));
    if (match) {
      used.add(match.id);
      card.style.order = String(order.get(match.id) ?? index);
      return;
    }
    const looksLikeDog = card.textContent?.includes("Dog") ?? false;
    card.style.order = String(looksLikeDog ? 1000 : 900 + index);
  });
}

async function fetchCardPayload(week: number | null) {
  const token = window.localStorage.getItem("pickem_session_token");
  if (!token) return null;
  const query = week == null ? "" : `?week=${week}`;
  try {
    const response = await fetch(`/api/app-data${query}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });
    return response.ok ? await response.json() as CardPayload : null;
  } catch {
    return null;
  }
}

export default function CardOrderEnhancement() {
  useEffect(() => {
    let active = true;
    let timer = 0;
    let cached: { week: number | null; loadedAt: number; payload: CardPayload } | null = null;

    async function refresh(force = false) {
      if (!active || !myCardIsActive() || document.querySelector(".test-mode-banner")) return;
      const week = selectedWeek();
      if (!force && cached && cached.week === week && Date.now() - cached.loadedAt < 4_000) {
        applyOrder(cached.payload);
        return;
      }
      const payload = await fetchCardPayload(week);
      if (!active || !payload) return;
      cached = { week, loadedAt: Date.now(), payload };
      applyOrder(payload);
    }

    function schedule(force = false) {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void refresh(force), 650);
    }

    const observer = new MutationObserver(() => schedule(false));
    observer.observe(document.body, { subtree: true, childList: true });
    const onFocus = () => schedule(true);
    window.addEventListener("focus", onFocus);
    schedule(true);

    return () => {
      active = false;
      window.clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return null;
}
