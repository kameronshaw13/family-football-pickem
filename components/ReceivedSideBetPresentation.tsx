"use client";

import { useEffect } from "react";

type ReceivedBet = {
  id: string;
  creator_id: string;
  offered_team: string;
  offered_spread: number | string;
  creator_team: string;
  creator_spread: number | string;
  amount: number | string;
  status: string;
  created_at: string;
  creator?: { display_name?: string | null } | null;
  game?: {
    away_team: string;
    home_team: string;
    away_logo_url?: string | null;
    home_logo_url?: string | null;
    commence_time: string;
  } | null;
  targets?: Array<{ recipient_id: string; response: string }> | null;
};

type AppDataPayload = {
  currentUser?: { id: string };
  sideBets?: ReceivedBet[];
};

const CENTRAL_SIDE_BET_TIME = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Chicago"
});

function spreadLabel(value: number | string) {
  const spread = Number(value);
  if (!Number.isFinite(spread)) return "";
  if (spread === 0) return "PK";
  return `${spread > 0 ? "+" : ""}${spread}`;
}

function moneyLabel(value: number | string) {
  const amount = Math.abs(Number(value));
  return `$${amount.toFixed(Number.isInteger(amount) ? 0 : 2)}`;
}

function stripTrailingSpread(value: string) {
  return value.replace(/\s+(?:PK|[+-]\d+(?:\.\d+)?)$/i, "").trim();
}

function receivedViewIsActive() {
  if (document.querySelector(".test-mode-banner")) return false;
  const center = document.querySelector(".side-bet-center");
  if (!center) return false;
  const trigger = center.querySelector<HTMLButtonElement>('button[aria-label="Choose side bet view"]');
  const label = trigger?.querySelector(".custom-select-label")?.textContent?.trim() || "";
  return label.startsWith("For You");
}

function clearEnhancements() {
  document.querySelectorAll<HTMLElement>(".side-bet-card.received-offer-enhanced").forEach((card) => {
    card.classList.remove("received-offer-enhanced");
    card.querySelectorAll(":scope > .received-offer-perspective").forEach((row) => row.remove());
  });
}

function buildPerspectiveRow(card: HTMLElement, bet: ReceivedBet) {
  const originalRow = card.querySelector<HTMLElement>(":scope > .side-bet-offer-row:not(.received-offer-perspective)");
  if (!originalRow || !bet.game) return;

  const originalTitle = originalRow.querySelector<HTMLElement>(".side-bet-offer-copy > strong")?.textContent?.trim() || "";
  const [rawLeft = "", rawRight = ""] = originalTitle.split(" at ");
  const left = stripTrailingSpread(rawLeft);
  const right = stripTrailingSpread(rawRight);
  const offeredIsAway = bet.offered_team === bet.game.away_team;
  const offeredSpread = spreadLabel(bet.offered_spread);
  const offeredName = offeredIsAway ? left : right;
  const mainText = left && right
    ? offeredIsAway
      ? `${left} ${offeredSpread} at ${right}`
      : `${left} at ${right} ${offeredSpread}`
    : `${offeredName || bet.offered_team} ${offeredSpread}`;
  const sender = bet.creator?.display_name?.trim() || "Opponent";
  const kickoff = CENTRAL_SIDE_BET_TIME.format(new Date(bet.game.commence_time));
  const logo = offeredIsAway ? bet.game.away_logo_url : bet.game.home_logo_url;

  const row = document.createElement("div");
  row.className = "side-bet-offer-row received-offer-perspective";
  row.dataset.sideBetId = bet.id;

  if (logo) {
    const img = document.createElement("img");
    img.src = logo;
    img.alt = "";
    img.className = "team-logo";
    img.width = 34;
    img.height = 34;
    img.loading = "lazy";
    img.decoding = "async";
    row.appendChild(img);
  } else {
    const fallback = document.createElement("div");
    fallback.className = "team-logo fallback";
    fallback.textContent = (offeredName || bet.offered_team).slice(0, 1);
    row.appendChild(fallback);
  }

  const copy = document.createElement("div");
  copy.className = "side-bet-offer-copy";
  const title = document.createElement("strong");
  title.textContent = mainText;
  const detail = document.createElement("p");
  detail.textContent = `${sender} offered · ${offeredName || bet.offered_team} ${offeredSpread} · ${kickoff}`;
  copy.append(title, detail);
  row.appendChild(copy);

  const amount = document.createElement("strong");
  amount.className = "side-bet-offer-amount money-neutral";
  amount.textContent = moneyLabel(bet.amount);
  row.appendChild(amount);

  card.insertBefore(row, originalRow);
  card.classList.add("received-offer-enhanced");
}

function applyEnhancements(payload: AppDataPayload | null) {
  if (!receivedViewIsActive() || !payload?.currentUser?.id) {
    clearEnhancements();
    return;
  }

  const userId = payload.currentUser.id;
  const offers = (payload.sideBets || [])
    .filter((bet) => bet.creator_id !== userId && bet.status === "open" && bet.targets?.some((target) => target.recipient_id === userId && target.response === "pending"))
    .filter((bet) => !bet.game || new Date(bet.game.commence_time).getTime() > Date.now())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const cards = Array.from(document.querySelectorAll<HTMLElement>(".side-bet-card.mode-received.open:not(.test-incoming-side-bet)"));

  cards.forEach((card, index) => {
    const bet = offers[index];
    const existing = card.querySelector<HTMLElement>(":scope > .received-offer-perspective");
    if (!bet) {
      existing?.remove();
      card.classList.remove("received-offer-enhanced");
      return;
    }
    if (existing?.dataset.sideBetId === bet.id) return;
    existing?.remove();
    buildPerspectiveRow(card, bet);
  });
}

export default function ReceivedSideBetPresentation() {
  useEffect(() => {
    let active = true;
    let payload: AppDataPayload | null = null;
    let loading = false;
    let lastLoaded = 0;
    let frame = 0;

    async function refresh(force = false) {
      if (!active || loading || !receivedViewIsActive()) {
        applyEnhancements(payload);
        return;
      }
      if (!force && payload && Date.now() - lastLoaded < 15_000) {
        applyEnhancements(payload);
        return;
      }
      const token = window.localStorage.getItem("pickem_session_token");
      if (!token) return;
      loading = true;
      try {
        const response = await fetch("/api/app-data", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store"
        });
        if (!response.ok) return;
        payload = await response.json() as AppDataPayload;
        lastLoaded = Date.now();
        if (active) applyEnhancements(payload);
      } catch {
        // Presentation enhancement is non-critical; the underlying side-bet UI remains usable.
      } finally {
        loading = false;
      }
    }

    function schedule() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => void refresh());
    }

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    const onFocus = () => void refresh(true);
    window.addEventListener("focus", onFocus);
    void refresh(true);

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("focus", onFocus);
      clearEnhancements();
    };
  }, []);

  return null;
}
