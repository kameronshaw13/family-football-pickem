"use client";

import { useEffect } from "react";

type ProfileRef = { id?: string; display_name?: string };
type Target = {
  recipient_id?: string;
  response?: string;
  responded_at?: string | null;
  recipient?: ProfileRef | null;
};
type Game = {
  away_team?: string;
  home_team?: string;
  away_logo_url?: string | null;
  home_logo_url?: string | null;
  commence_time?: string;
  league?: string;
};
type Bet = {
  id: string;
  creator_id: string;
  status: string;
  created_at: string;
  amount?: number;
  creator_team?: string;
  offered_team?: string;
  creator_spread?: number;
  offered_spread?: number;
  accepted_by?: string | null;
  accepted_by_profile?: ProfileRef | null;
  creator?: ProfileRef | null;
  game?: Game | null;
  targets?: Target[];
};
type AppData = {
  currentUser?: ProfileRef;
  sideBets?: Bet[];
};

type BetMode = "received" | "sent";

const RESPONSE_CLASSES = ["accepted", "declined", "pending"];
const MULTIWORD_SUFFIXES = [
  "Tar Heels", "Horned Frogs", "Blue Devils", "Red Raiders", "Crimson Tide", "Golden Bears",
  "Golden Gophers", "Golden Eagles", "Fighting Irish", "Fighting Illini", "Green Wave", "Yellow Jackets",
  "Scarlet Knights", "Black Knights", "Blue Raiders", "Red Wolves", "Sun Devils", "Demon Deacons",
  "Thundering Herd", "Rainbow Warriors", "Ragin Cajuns", "Ragin' Cajuns", "Wolf Pack"
];
const SINGLE_SUFFIXES = [
  "Wolfpack", "Cavaliers", "Wildcats", "Bulldogs", "Tigers", "Eagles", "Hawks", "Falcons", "Bears", "Bruins",
  "Rams", "Aggies", "Spartans", "Trojans", "Cardinals", "Pirates", "Knights", "Warriors", "Raiders", "Rebels",
  "Mustangs", "Owls", "Cougars", "Huskies", "Bearcats", "Bearkats", "Cowboys", "Utes", "Ducks", "Beavers",
  "Hokies", "Gators", "Longhorns", "Sooners", "Cyclones", "Buffaloes", "Hurricanes", "Seminoles", "Volunteers",
  "Razorbacks", "Jayhawks", "Buckeyes", "Wolverines", "Badgers", "Hawkeyes", "Hoosiers", "Terrapins", "Cornhuskers",
  "Mountaineers", "Commodores", "Boilermakers", "Roadrunners", "Miners", "Blazers", "Lobos", "Aztecs", "Bulls",
  "Zips", "Bobcats", "Rockets", "Chippewas", "Panthers", "Lions", "Vikings", "Patriots", "Titans", "Broncos",
  "Chiefs", "Chargers", "Dolphins", "Packers", "Steelers", "Ravens", "Saints", "Seahawks", "Texans", "Bengals",
  "Bills", "Browns", "Buccaneers", "Commanders", "Jaguars", "Jets", "Raiders", "49ers"
];

function groupSlug() {
  const path = window.location.pathname;
  if (path === "/friends" || path.startsWith("/friends/")) return "friends";
  if (path === "/caleb-family" || path.startsWith("/caleb-family/")) return "other-family";
  return "shaw-family";
}

function spreadText(value?: number) {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return "Pick'em";
  return number > 0 ? `+${number}` : String(number);
}

function stakeText(value?: number) {
  const number = Math.abs(Number(value || 0));
  return `$${number.toFixed(Number.isInteger(number) ? 0 : 2)}`;
}

function kickoffText(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Chicago" }).format(date).slice(0, 3);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }).format(date);
  return `${day} ${time}`;
}

function fallbackDisplayName(team?: string, league?: string) {
  if (!team) return "Team";
  if (league === "NFL") return team.split(/\s+/).slice(-1)[0] || team;
  const normalized = team.toLowerCase();
  const manual: Record<string, string> = {
    "north carolina tar heels": "North Carolina",
    "nc state wolfpack": "NC State",
    "n.c. state wolfpack": "NC State",
    "tcu horned frogs": "TCU",
    "virginia cavaliers": "Virginia",
    "ohio state buckeyes": "Ohio State",
    "san jose state spartans": "San Jose State",
    "appalachian state mountaineers": "App State",
    "ole miss rebels": "Ole Miss"
  };
  if (manual[normalized]) return manual[normalized];
  for (const suffix of MULTIWORD_SUFFIXES) {
    if (team.toLowerCase().endsWith(` ${suffix.toLowerCase()}`)) return team.slice(0, -suffix.length).trim();
  }
  for (const suffix of SINGLE_SUFFIXES) {
    if (team.toLowerCase().endsWith(` ${suffix.toLowerCase()}`)) return team.slice(0, -suffix.length).trim();
  }
  return team;
}

function logoForTeam(game: Game | null | undefined, team?: string) {
  if (!game || !team) return null;
  if (team === game.home_team) return game.home_logo_url || null;
  if (team === game.away_team) return game.away_logo_url || null;
  return null;
}

function responseTarget(bet: Bet) {
  if (bet.accepted_by) {
    return bet.targets?.find((target) => target.recipient_id === bet.accepted_by) || null;
  }
  return bet.targets?.find((target) => target.response === "accepted" || target.response === "declined") || null;
}

function sortBets(bets: Bet[]) {
  return [...bets].sort((a, b) => Number(b.status === "open") - Number(a.status === "open") || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function betsForMode(payload: AppData, mode: BetMode) {
  const userId = payload.currentUser?.id;
  if (!userId) return [];
  const bets = payload.sideBets || [];
  return sortBets(mode === "sent"
    ? bets.filter((bet) => bet.creator_id === userId)
    : bets.filter((bet) => bet.creator_id !== userId && bet.targets?.some((target) => target.recipient_id === userId)));
}

function seenKey(userId: string) {
  return `pickem_seen_accepted_side_bets:${groupSlug()}:${userId}`;
}

function readSeen(userId: string) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(seenKey(userId)) || "[]") as string[];
    return new Set(parsed.filter(Boolean));
  } catch {
    return new Set<string>();
  }
}

function addSeen(userId: string, ids: string[]) {
  if (!ids.length) return;
  const seen = readSeen(userId);
  ids.forEach((id) => seen.add(id));
  try { window.localStorage.setItem(seenKey(userId), JSON.stringify(Array.from(seen))); } catch { /* ignore storage failures */ }
}

function namesFromCard(card: HTMLElement, bet: Bet) {
  const main = card.querySelector<HTMLElement>(".side-bet-offer-copy > strong");
  const text = main?.textContent?.trim() || "";
  const cleaned = text
    .replace(/\bPick'em\b/gi, "")
    .replace(/[+-]\d+(?:\.\d+)?/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const parts = cleaned.split(/\s+at\s+/i);
  if (parts.length === 2 && bet.game?.away_team && bet.game?.home_team) {
    return { away: parts[0].trim(), home: parts[1].trim() };
  }
  return {
    away: fallbackDisplayName(bet.game?.away_team, bet.game?.league),
    home: fallbackDisplayName(bet.game?.home_team, bet.game?.league)
  };
}

function teamDisplayName(card: HTMLElement, bet: Bet, team?: string) {
  const names = namesFromCard(card, bet);
  if (team && team === bet.game?.away_team) return names.away;
  if (team && team === bet.game?.home_team) return names.home;
  return fallbackDisplayName(team, bet.game?.league);
}

function setCardLogo(card: HTMLElement, bet: Bet, team?: string) {
  const host = card.querySelector<HTMLElement>(".side-bet-offer-row > .team-logo");
  if (!host || !team) return;
  const url = logoForTeam(bet.game, team);
  if (host instanceof HTMLImageElement) {
    if (url && host.src !== url) host.src = url;
    host.alt = "";
    return;
  }
  if (!url) {
    const initial = teamDisplayName(card, bet, team).slice(0, 1);
    if (host.textContent !== initial) host.textContent = initial;
    return;
  }
  const image = document.createElement("img");
  image.src = url;
  image.alt = "";
  image.className = "team-logo";
  image.width = 34;
  image.height = 34;
  image.loading = "lazy";
  host.replaceWith(image);
}

function responsePresentation(bet: Bet, mode: BetMode, userId: string, card: HTMLElement) {
  const offeredName = teamDisplayName(card, bet, bet.offered_team);
  const offeredLine = `${offeredName} ${spreadText(bet.offered_spread)}`;
  const target = responseTarget(bet);
  const recipientNames = (bet.targets || []).map((item) => item.recipient?.display_name).filter(Boolean).join(" or ") || "player";
  const creatorName = bet.creator?.display_name || "Player";

  if (bet.status === "accepted" || target?.response === "accepted") {
    const actor = (bet.accepted_by || target?.recipient_id) === userId ? "You" : bet.accepted_by_profile?.display_name || target?.recipient?.display_name || recipientNames;
    return { actor, action: "Accepted", tone: "accepted", tail: offeredLine };
  }
  if (bet.status === "declined" || target?.response === "declined") {
    const actor = target?.recipient_id === userId ? "You" : target?.recipient?.display_name || recipientNames;
    return { actor, action: "Declined", tone: "declined", tail: offeredLine };
  }
  if (bet.status === "cancelled") {
    return { actor: bet.creator_id === userId ? "You" : creatorName, action: "Cancelled", tone: "declined", tail: offeredLine };
  }
  if (bet.status === "expired") {
    return { actor: "Offer", action: "Expired", tone: "declined", tail: offeredLine };
  }
  if (mode === "received") {
    return { actor: creatorName, action: "Offered", tone: "pending", tail: offeredLine };
  }
  return { actor: "You", action: "Offered", tone: "pending", tail: `${recipientNames} ${offeredLine}` };
}

function renderResponseLine(card: HTMLElement, bet: Bet, mode: BetMode, userId: string) {
  const paragraph = card.querySelector<HTMLParagraphElement>(".side-bet-offer-copy p");
  if (!paragraph) return;
  const presentation = responsePresentation(bet, mode, userId, card);
  const kickoff = kickoffText(bet.game?.commence_time);
  const signature = `${presentation.actor}|${presentation.action}|${presentation.tone}|${presentation.tail}|${kickoff}`;
  if (paragraph.dataset.sideBetPresentation === signature) return;
  paragraph.dataset.sideBetPresentation = signature;
  paragraph.replaceChildren();
  paragraph.append(document.createTextNode(`${presentation.actor} `));
  const action = document.createElement("span");
  action.className = `side-bet-response ${presentation.tone}`;
  RESPONSE_CLASSES.forEach((name) => { if (name !== presentation.tone) action.classList.remove(name); });
  action.textContent = presentation.action;
  paragraph.append(action, document.createTextNode(` ${presentation.tail}`));
  if (kickoff) paragraph.append(document.createTextNode(` · ${kickoff}`));
}

function renderMainLine(card: HTMLElement, bet: Bet, userId: string) {
  const main = card.querySelector<HTMLElement>(".side-bet-offer-copy > strong");
  if (!main) return;
  const isCreator = bet.creator_id === userId;
  const team = isCreator ? bet.creator_team : bet.offered_team;
  const spread = isCreator ? bet.creator_spread : bet.offered_spread;
  const names = namesFromCard(card, bet);
  let text = `${teamDisplayName(card, bet, team)} ${spreadText(spread)}`;
  if (bet.game?.away_team && bet.game?.home_team) {
    text = team === bet.game.away_team
      ? `${names.away} ${spreadText(spread)} at ${names.home}`
      : `${names.away} at ${names.home} ${spreadText(spread)}`;
  }
  if (main.textContent?.trim() !== text) main.textContent = text;
  setCardLogo(card, bet, team);
}

function renderCards(payload: AppData, mode: BetMode, seen: Set<string>) {
  const userId = payload.currentUser?.id;
  if (!userId) return [] as string[];
  const bets = betsForMode(payload, mode);
  const cards = Array.from(document.querySelectorAll<HTMLElement>(`.side-bet-card.mode-${mode}`));
  const visibleAccepted: string[] = [];
  cards.forEach((card, index) => {
    const bet = bets[index];
    if (!bet) return;
    card.dataset.sideBetId = bet.id;
    const acceptedAndSeen = bet.status === "accepted" && seen.has(bet.id);
    if (card.hidden !== acceptedAndSeen) card.hidden = acceptedAndSeen;
    if (!acceptedAndSeen && bet.status === "accepted") visibleAccepted.push(bet.id);
    renderMainLine(card, bet, userId);
    renderResponseLine(card, bet, mode, userId);
  });
  return visibleAccepted;
}

function addReviewLogos(payload: AppData, reviewBetId: string | null) {
  if (!reviewBetId) return;
  const bet = (payload.sideBets || []).find((item) => item.id === reviewBetId);
  if (!bet?.game) return;
  const rows = Array.from(document.querySelectorAll<HTMLElement>(".confirmation-matchup > div"));
  if (rows.length < 2) return;
  const teams = [bet.offered_team, bet.creator_team];
  rows.slice(0, 2).forEach((row, index) => {
    const team = teams[index];
    const url = logoForTeam(bet.game, team);
    if (!url) return;
    let image = row.querySelector<HTMLImageElement>(".side-bet-review-logo");
    if (!image) {
      image = document.createElement("img");
      image.className = "team-logo side-bet-review-logo";
      image.alt = "";
      image.width = 30;
      image.height = 30;
      image.loading = "eager";
      const strong = row.querySelector("strong");
      if (strong) row.insertBefore(image, strong);
      else row.append(image);
    }
    if (image.src !== url) image.src = url;
  });
}

function renderAcceptedLedger(payload: AppData) {
  const ledger = document.querySelector<HTMLElement>(".ledger-list");
  const userId = payload.currentUser?.id;
  if (!ledger || !userId) return;
  const accepted = (payload.sideBets || [])
    .filter((bet) => bet.status === "accepted" && (bet.creator_id === userId || bet.accepted_by === userId))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const signature = accepted.map((bet) => `${bet.id}:${bet.accepted_by}:${bet.amount}`).join("|");
  if (ledger.dataset.acceptedSideBetSignature === signature) return;
  ledger.dataset.acceptedSideBetSignature = signature;
  ledger.querySelectorAll(".side-bet-ledger-row.runtime-accepted").forEach((node) => node.remove());
  const empty = Array.from(ledger.querySelectorAll<HTMLElement>("p.muted")).find((node) => /No settled side bets yet/i.test(node.textContent || ""));
  if (empty) empty.hidden = accepted.length > 0;

  const before = ledger.firstChild;
  accepted.forEach((bet) => {
    const isCreator = bet.creator_id === userId;
    const team = isCreator ? bet.creator_team : bet.offered_team;
    const spread = isCreator ? bet.creator_spread : bet.offered_spread;
    const name = fallbackDisplayName(team, bet.game?.league);
    const creatorName = bet.creator?.display_name || "Player";
    const acceptorName = bet.accepted_by_profile?.display_name || responseTarget(bet)?.recipient?.display_name || "Opponent";
    const row = document.createElement("div");
    row.className = "ledger-row side-bet-ledger-row runtime-accepted";
    row.dataset.sideBetId = bet.id;

    const logo = logoForTeam(bet.game, team);
    if (logo) {
      const image = document.createElement("img");
      image.src = logo;
      image.alt = "";
      image.className = "team-logo";
      image.width = 34;
      image.height = 34;
      image.loading = "lazy";
      row.append(image);
    } else {
      const fallback = document.createElement("div");
      fallback.className = "team-logo fallback";
      fallback.textContent = name.slice(0, 1);
      row.append(fallback);
    }

    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `${name} ${spreadText(spread)}`;
    const meta = document.createElement("p");
    meta.textContent = `${creatorName} vs ${acceptorName} · Accepted`;
    copy.append(title, meta);
    const amount = document.createElement("strong");
    amount.className = "money-neutral";
    amount.textContent = stakeText(bet.amount);
    row.append(copy, amount);
    ledger.insertBefore(row, before);
  });
}

export default function SideBetDisplayGuard() {
  useEffect(() => {
    let stopped = false;
    let payload: AppData | null = null;
    let previousMode: BetMode | null = null;
    let acceptedShownInPreviousMode: string[] = [];
    let reviewBetId: string | null = null;
    let applying = false;

    function activeMode(): BetMode | null {
      if (document.querySelector(".side-bet-card.mode-sent")) return "sent";
      if (document.querySelector(".side-bet-card.mode-received")) return "received";
      return null;
    }

    function apply() {
      if (stopped || applying || !payload?.currentUser?.id) return;
      applying = true;
      try {
        const userId = payload.currentUser.id;
        const mode = activeMode();
        if (previousMode && previousMode !== mode && acceptedShownInPreviousMode.length) {
          addSeen(userId, acceptedShownInPreviousMode);
        }
        const seen = readSeen(userId);
        const shown = mode ? renderCards(payload, mode, seen) : [];
        previousMode = mode;
        acceptedShownInPreviousMode = shown;
        addReviewLogos(payload, reviewBetId);
        renderAcceptedLedger(payload);
      } finally {
        applying = false;
      }
    }

    async function refresh() {
      if (stopped || document.visibilityState !== "visible") return;
      if (!document.querySelector(".side-bet-center, .ledger-list, .confirmation-sheet")) return;
      const token = window.localStorage.getItem("pickem_session_token");
      if (!token) return;
      try {
        const response = await fetch("/api/app-data", {
          headers: { Authorization: `Bearer ${token}`, "x-pickem-group": groupSlug() },
          cache: "no-store"
        });
        if (!response.ok) return;
        payload = await response.json() as AppData;
        apply();
      } catch {
        // Keep the native rendering if a brief network interruption occurs.
      }
    }

    function captureReview(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button");
      if (!button || !/review\s*&?\s*accept/i.test(button.textContent || "")) return;
      const card = button.closest<HTMLElement>(".side-bet-card.mode-received");
      if (card?.dataset.sideBetId) {
        reviewBetId = card.dataset.sideBetId;
        window.setTimeout(apply, 0);
      }
    }

    const observer = new MutationObserver(() => window.requestAnimationFrame(apply));
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    document.addEventListener("click", captureReview, true);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2500);

    return () => {
      if (payload?.currentUser?.id && previousMode && acceptedShownInPreviousMode.length) {
        addSeen(payload.currentUser.id, acceptedShownInPreviousMode);
      }
      stopped = true;
      observer.disconnect();
      document.removeEventListener("click", captureReview, true);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
