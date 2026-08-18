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
const CENTRAL_SIDE_BET_DATE = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "America/Chicago"
});
const CENTRAL_SIDE_BET_CLOCK = new Intl.DateTimeFormat("en-US", {
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
  const awayDisplay = left || bet.game.away_team;
  const homeDisplay = right || bet.game.home_team;
  const offeredIsAway = bet.offered_team === bet.game.away_team;
  const offeredSpread = spreadLabel(bet.offered_spread);
  const offeredName = offeredIsAway ? awayDisplay : homeDisplay;
  const mainText = offeredIsAway
    ? `${awayDisplay} ${offeredSpread} at ${homeDisplay}`
    : `${awayDisplay} at ${homeDisplay} ${offeredSpread}`;
  const sender = bet.creator?.display_name?.trim() || "Opponent";
  const kickoff = CENTRAL_SIDE_BET_TIME.format(new Date(bet.game.commence_time));
  const logo = offeredIsAway ? bet.game.away_logo_url : bet.game.home_logo_url;

  const row = document.createElement("div");
  row.className = "side-bet-offer-row received-offer-perspective";
  row.dataset.sideBetId = bet.id;
  row.dataset.awayName = awayDisplay;
  row.dataset.homeName = homeDisplay;

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
    fallback.textContent = offeredName.slice(0, 1);
    row.appendChild(fallback);
  }

  const copy = document.createElement("div");
  copy.className = "side-bet-offer-copy";
  const title = document.createElement("strong");
  title.textContent = mainText;
  const detail = document.createElement("p");
  detail.textContent = `${sender} offered · ${offeredName} ${offeredSpread} · ${kickoff}`;
  copy.append(title, detail);
  row.appendChild(copy);

  const amount = document.createElement("strong");
  amount.className = "side-bet-offer-amount money-neutral";
  amount.textContent = moneyLabel(bet.amount);
  row.appendChild(amount);

  card.insertBefore(row, originalRow);
  card.classList.add("received-offer-enhanced");
}

function addConfirmationLogo(row: HTMLElement, url: string | null | undefined, name: string) {
  row.querySelector(":scope > .confirmation-team-logo")?.remove();
  const strong = row.querySelector(":scope > strong");
  if (!strong) return;

  if (url) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = "";
    img.className = "confirmation-team-logo";
    img.width = 36;
    img.height = 36;
    img.loading = "eager";
    img.decoding = "async";
    row.insertBefore(img, strong);
  } else {
    const fallback = document.createElement("span");
    fallback.className = "confirmation-team-logo confirmation-team-logo-fallback";
    fallback.textContent = name.slice(0, 1);
    row.insertBefore(fallback, strong);
  }
}

function enhanceReviewModal(payload: AppDataPayload | null, betId: string | null) {
  const sheet = document.querySelector<HTMLElement>(".confirmation-backdrop:not(.test-confirmation-backdrop) .confirmation-sheet");
  if (!sheet || !payload || !betId) return;
  const bet = payload.sideBets?.find((item) => item.id === betId);
  if (!bet?.game) return;
  if (sheet.dataset.sideBetId === bet.id && sheet.classList.contains("received-review-enhanced")) return;

  const perspective = document.querySelector<HTMLElement>(`.received-offer-perspective[data-side-bet-id="${CSS.escape(bet.id)}"]`);
  const awayDisplay = perspective?.dataset.awayName || bet.game.away_team;
  const homeDisplay = perspective?.dataset.homeName || bet.game.home_team;
  const offeredIsAway = bet.offered_team === bet.game.away_team;
  const offeredDisplay = offeredIsAway ? awayDisplay : homeDisplay;
  const creatorDisplay = offeredIsAway ? homeDisplay : awayDisplay;
  const sender = bet.creator?.display_name?.trim() || "Opponent";
  const kickoff = new Date(bet.game.commence_time);

  sheet.dataset.sideBetId = bet.id;
  sheet.classList.add("received-review-enhanced");

  const heading = sheet.querySelector<HTMLElement>(".confirmation-heading");
  const headingLabel = heading?.querySelector<HTMLElement>(":scope > span");
  const headingTitle = heading?.querySelector<HTMLElement>(":scope > h2");
  if (headingLabel) headingLabel.textContent = "";
  if (headingTitle) headingTitle.textContent = "Review Bet";

  sheet.querySelector(":scope > .confirmation-amount-row")?.remove();
  if (heading) {
    const amountRow = document.createElement("div");
    amountRow.className = "confirmation-amount-row";
    const amountLabel = document.createElement("span");
    amountLabel.textContent = "Amount";
    const amountValue = document.createElement("strong");
    amountValue.textContent = moneyLabel(bet.amount);
    amountRow.append(amountLabel, amountValue);
    heading.insertAdjacentElement("afterend", amountRow);
  }

  const rows = Array.from(sheet.querySelectorAll<HTMLElement>(".confirmation-matchup > div"));
  if (rows[0]) {
    rows[0].classList.add("confirmation-team-row");
    const label = rows[0].querySelector<HTMLElement>(":scope > span");
    const value = rows[0].querySelector<HTMLElement>(":scope > strong");
    if (label) label.textContent = "You get";
    if (value) value.textContent = `${offeredDisplay} ${spreadLabel(bet.offered_spread)}`;
    addConfirmationLogo(rows[0], offeredIsAway ? bet.game.away_logo_url : bet.game.home_logo_url, offeredDisplay);
  }
  if (rows[1]) {
    rows[1].classList.add("confirmation-team-row");
    const label = rows[1].querySelector<HTMLElement>(":scope > span");
    const value = rows[1].querySelector<HTMLElement>(":scope > strong");
    if (label) label.textContent = `${sender} gets`;
    if (value) value.textContent = `${creatorDisplay} ${spreadLabel(bet.creator_spread)}`;
    addConfirmationLogo(rows[1], offeredIsAway ? bet.game.home_logo_url : bet.game.away_logo_url, creatorDisplay);
  }

  const meta = sheet.querySelector<HTMLElement>(".confirmation-kickoff");
  if (meta) {
    meta.textContent = `${CENTRAL_SIDE_BET_DATE.format(kickoff)} · ${CENTRAL_SIDE_BET_CLOCK.format(kickoff)} · ${awayDisplay} at ${homeDisplay}`;
  }
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
    let pendingReviewBetId: string | null = null;

    async function refresh(force = false) {
      if (!active || loading || !receivedViewIsActive()) {
        applyEnhancements(payload);
        enhanceReviewModal(payload, pendingReviewBetId);
        return;
      }
      if (!force && payload && Date.now() - lastLoaded < 15_000) {
        applyEnhancements(payload);
        enhanceReviewModal(payload, pendingReviewBetId);
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
        if (active) {
          applyEnhancements(payload);
          enhanceReviewModal(payload, pendingReviewBetId);
        }
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

    function rememberReviewBet(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLButtonElement>(".side-bet-card.mode-received.open .actions .btn.accept");
      if (!button) return;
      const card = button.closest<HTMLElement>(".side-bet-card");
      const perspective = card?.querySelector<HTMLElement>(":scope > .received-offer-perspective");
      if (!perspective?.dataset.sideBetId) return;
      pendingReviewBetId = perspective.dataset.sideBetId;
      window.requestAnimationFrame(() => enhanceReviewModal(payload, pendingReviewBetId));
    }

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    const onFocus = () => void refresh(true);
    window.addEventListener("focus", onFocus);
    document.addEventListener("click", rememberReviewBet, true);
    void refresh(true);

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("click", rememberReviewBet, true);
      clearEnhancements();
    };
  }, []);

  return null;
}
