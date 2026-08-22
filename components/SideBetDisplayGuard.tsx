"use client";

import { useEffect } from "react";

type ProfileRef = { id?: string; display_name?: string };
type Target = { recipient_id?: string; response?: string; responded_at?: string | null; recipient?: ProfileRef | null };
type Game = { away_team?: string; home_team?: string; away_logo_url?: string | null; home_logo_url?: string | null; commence_time?: string; league?: string };
type Bet = {
  id: string; creator_id: string; status: string; created_at: string; amount?: number;
  creator_team?: string; offered_team?: string; creator_spread?: number; offered_spread?: number;
  accepted_by?: string | null; accepted_by_profile?: ProfileRef | null; creator?: ProfileRef | null;
  game?: Game | null; targets?: Target[]; result?: string; winner_id?: string | null;
};
type AppData = { currentUser?: ProfileRef; sideBets?: Bet[] };
type BetMode = "received" | "sent";

const RESPONSE_CLASSES = ["accepted", "declined", "pending"];
const MULTIWORD_SUFFIXES = ["Tar Heels", "Horned Frogs", "Blue Devils", "Red Raiders", "Crimson Tide", "Golden Bears", "Golden Gophers", "Golden Eagles", "Fighting Irish", "Fighting Illini", "Green Wave", "Yellow Jackets", "Scarlet Knights", "Black Knights", "Blue Raiders", "Red Wolves", "Sun Devils", "Demon Deacons", "Thundering Herd", "Rainbow Warriors", "Ragin Cajuns", "Ragin' Cajuns", "Wolf Pack"];
const SINGLE_SUFFIXES = ["Wolfpack", "Cavaliers", "Wildcats", "Bulldogs", "Tigers", "Eagles", "Hawks", "Falcons", "Bears", "Bruins", "Rams", "Aggies", "Spartans", "Trojans", "Cardinals", "Pirates", "Knights", "Warriors", "Raiders", "Rebels", "Mustangs", "Owls", "Cougars", "Huskies", "Bearcats", "Bearkats", "Cowboys", "Utes", "Ducks", "Beavers", "Hokies", "Gators", "Longhorns", "Sooners", "Cyclones", "Buffaloes", "Hurricanes", "Seminoles", "Volunteers", "Razorbacks", "Jayhawks", "Buckeyes", "Wolverines", "Badgers", "Hawkeyes", "Hoosiers", "Terrapins", "Cornhuskers", "Mountaineers", "Commodores", "Boilermakers", "Roadrunners", "Miners", "Blazers", "Lobos", "Aztecs", "Bulls", "Zips", "Bobcats", "Rockets", "Chippewas", "Panthers", "Lions", "Vikings", "Patriots", "Titans", "Broncos", "Chiefs", "Chargers", "Dolphins", "Packers", "Steelers", "Ravens", "Saints", "Seahawks", "Texans", "Bengals", "Bills", "Browns", "Buccaneers", "Commanders", "Jaguars", "Jets", "Raiders", "49ers"];

function groupSlug() {
  const path = window.location.pathname;
  if (path === "/friends" || path.startsWith("/friends/")) return "friends";
  if (path === "/caleb-family" || path.startsWith("/caleb-family/")) return "other-family";
  return "shaw-family";
}
function spreadText(value?: number) { const n = Number(value); if (!Number.isFinite(n) || n === 0) return "Pick'em"; return n > 0 ? `+${n}` : String(n); }
function stakeText(value?: number) { const n = Math.abs(Number(value || 0)); return `$${n.toFixed(Number.isInteger(n) ? 0 : 2)}`; }
function kickoffText(iso?: string) {
  if (!iso) return ""; const date = new Date(iso); if (Number.isNaN(date.getTime())) return "";
  const day = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Chicago" }).format(date).slice(0, 3);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }).format(date);
  return `${day} ${time}`;
}
function fallbackDisplayName(team?: string, league?: string) {
  if (!team) return "Team"; if (league === "NFL") return team.split(/\s+/).slice(-1)[0] || team;
  const normalized = team.toLowerCase();
  const manual: Record<string, string> = { "north carolina tar heels": "North Carolina", "nc state wolfpack": "NC State", "n.c. state wolfpack": "NC State", "tcu horned frogs": "TCU", "virginia cavaliers": "Virginia", "ohio state buckeyes": "Ohio State", "san jose state spartans": "San Jose State", "appalachian state mountaineers": "App State", "ole miss rebels": "Ole Miss" };
  if (manual[normalized]) return manual[normalized];
  for (const suffix of MULTIWORD_SUFFIXES) if (team.toLowerCase().endsWith(` ${suffix.toLowerCase()}`)) return team.slice(0, -suffix.length).trim();
  for (const suffix of SINGLE_SUFFIXES) if (team.toLowerCase().endsWith(` ${suffix.toLowerCase()}`)) return team.slice(0, -suffix.length).trim();
  return team;
}
function logoForTeam(game: Game | null | undefined, team?: string) { if (!game || !team) return null; if (team === game.home_team) return game.home_logo_url || null; if (team === game.away_team) return game.away_logo_url || null; return null; }
function responseTarget(bet: Bet) { if (bet.accepted_by) return bet.targets?.find((t) => t.recipient_id === bet.accepted_by) || null; return bet.targets?.find((t) => t.response === "accepted" || t.response === "declined") || null; }
function sortBets(bets: Bet[]) { return [...bets].sort((a, b) => Number(b.status === "open") - Number(a.status === "open") || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); }
function betsForMode(payload: AppData, mode: BetMode) {
  const userId = payload.currentUser?.id; if (!userId) return [];
  return sortBets(mode === "sent" ? (payload.sideBets || []).filter((b) => b.creator_id === userId) : (payload.sideBets || []).filter((b) => b.creator_id !== userId && b.targets?.some((t) => t.recipient_id === userId)));
}
function seenKey(userId: string) { return `pickem_seen_accepted_side_bets:${groupSlug()}:${userId}`; }
function readSeen(userId: string) { try { return new Set((JSON.parse(window.localStorage.getItem(seenKey(userId)) || "[]") as string[]).filter(Boolean)); } catch { return new Set<string>(); } }
function addSeen(userId: string, ids: string[]) { if (!ids.length) return; const seen = readSeen(userId); ids.forEach((id) => seen.add(id)); try { window.localStorage.setItem(seenKey(userId), JSON.stringify(Array.from(seen))); } catch {} }

function namesFromCard(card: HTMLElement, bet: Bet) {
  const text = card.querySelector<HTMLElement>(".side-bet-offer-copy > strong")?.textContent?.trim() || "";
  const parts = text.replace(/\bPick'em\b/gi, "").replace(/[+-]\d+(?:\.\d+)?/g, "").replace(/\s+/g, " ").trim().split(/\s+at\s+/i);
  if (parts.length === 2 && bet.game?.away_team && bet.game?.home_team) return { away: parts[0].trim(), home: parts[1].trim() };
  return { away: fallbackDisplayName(bet.game?.away_team, bet.game?.league), home: fallbackDisplayName(bet.game?.home_team, bet.game?.league) };
}
function teamDisplayName(card: HTMLElement, bet: Bet, team?: string) { const names = namesFromCard(card, bet); if (team === bet.game?.away_team) return names.away; if (team === bet.game?.home_team) return names.home; return fallbackDisplayName(team, bet.game?.league); }
function setCardLogo(card: HTMLElement, bet: Bet, team?: string) {
  const host = card.querySelector<HTMLElement>(".side-bet-offer-row > .team-logo"); if (!host || !team) return; const url = logoForTeam(bet.game, team);
  if (host instanceof HTMLImageElement) { if (url && host.src !== url) host.src = url; host.alt = ""; return; }
  if (!url) { host.textContent = teamDisplayName(card, bet, team).slice(0, 1); return; }
  const image = document.createElement("img"); image.src = url; image.alt = ""; image.className = "team-logo"; image.width = 34; image.height = 34; image.loading = "lazy"; host.replaceWith(image);
}
function responsePresentation(bet: Bet, mode: BetMode, userId: string, card: HTMLElement) {
  const offeredLine = `${teamDisplayName(card, bet, bet.offered_team)} ${spreadText(bet.offered_spread)}`;
  const target = responseTarget(bet); const recipientNames = (bet.targets || []).map((t) => t.recipient?.display_name).filter(Boolean).join(" or ") || "player"; const creatorName = bet.creator?.display_name || "Player";
  if (bet.status === "accepted" || target?.response === "accepted") return { actor: (bet.accepted_by || target?.recipient_id) === userId ? "You" : bet.accepted_by_profile?.display_name || target?.recipient?.display_name || recipientNames, action: "Accepted", tone: "accepted", tail: offeredLine };
  if (bet.status === "declined" || target?.response === "declined") return { actor: target?.recipient_id === userId ? "You" : target?.recipient?.display_name || recipientNames, action: "Declined", tone: "declined", tail: offeredLine };
  if (bet.status === "cancelled") return { actor: bet.creator_id === userId ? "You" : creatorName, action: "Cancelled", tone: "declined", tail: offeredLine };
  if (bet.status === "expired") return { actor: "Offer", action: "Expired", tone: "declined", tail: offeredLine };
  if (mode === "received") return { actor: creatorName, action: "Offered", tone: "pending", tail: offeredLine };
  return { actor: "You", action: "Offered", tone: "pending", tail: `${recipientNames} ${offeredLine}` };
}
function renderResponseLine(card: HTMLElement, bet: Bet, mode: BetMode, userId: string) {
  const p = card.querySelector<HTMLParagraphElement>(".side-bet-offer-copy p"); if (!p) return; const x = responsePresentation(bet, mode, userId, card); const kickoff = kickoffText(bet.game?.commence_time); const sig = `${x.actor}|${x.action}|${x.tone}|${x.tail}|${kickoff}`; if (p.dataset.sideBetPresentation === sig) return;
  p.dataset.sideBetPresentation = sig; p.replaceChildren(document.createTextNode(`${x.actor} `)); const action = document.createElement("span"); action.className = `side-bet-response ${x.tone}`; RESPONSE_CLASSES.forEach((name) => { if (name !== x.tone) action.classList.remove(name); }); action.textContent = x.action; p.append(action, document.createTextNode(` ${x.tail}`)); if (kickoff) p.append(document.createTextNode(` · ${kickoff}`));
}
function renderMainLine(card: HTMLElement, bet: Bet, userId: string) {
  const main = card.querySelector<HTMLElement>(".side-bet-offer-copy > strong"); if (!main) return; const creator = bet.creator_id === userId; const team = creator ? bet.creator_team : bet.offered_team; const spread = creator ? bet.creator_spread : bet.offered_spread; const names = namesFromCard(card, bet);
  const text = bet.game?.away_team && bet.game?.home_team ? (team === bet.game.away_team ? `${names.away} ${spreadText(spread)} at ${names.home}` : `${names.away} at ${names.home} ${spreadText(spread)}`) : `${teamDisplayName(card, bet, team)} ${spreadText(spread)}`;
  if (main.textContent?.trim() !== text) main.textContent = text; setCardLogo(card, bet, team);
}
function renderCards(payload: AppData, mode: BetMode, seen: Set<string>) {
  const userId = payload.currentUser?.id; if (!userId) return [] as string[]; const bets = betsForMode(payload, mode); const cards = Array.from(document.querySelectorAll<HTMLElement>(`.side-bet-card.mode-${mode}`)); const list = cards[0]?.closest<HTMLElement>(".side-bet-list") || null; if (list) list.style.visibility = ""; const shown: string[] = [];
  cards.forEach((card, index) => { const bet = bets[index]; if (!bet) return; card.dataset.sideBetId = bet.id; const hidden = bet.status === "accepted" && seen.has(bet.id); card.hidden = hidden; if (!hidden && bet.status === "accepted") shown.push(bet.id); renderMainLine(card, bet, userId); renderResponseLine(card, bet, mode, userId); }); return shown;
}
function addReviewLogos(payload: AppData, reviewBetId: string | null) {
  if (!reviewBetId) return; const bet = (payload.sideBets || []).find((b) => b.id === reviewBetId); if (!bet?.game) return; const rows = Array.from(document.querySelectorAll<HTMLElement>(".confirmation-matchup > div")); if (rows.length < 2) return;
  [bet.offered_team, bet.creator_team].forEach((team, index) => { const row = rows[index]; const url = logoForTeam(bet.game, team); if (!row || !url) return; let image = row.querySelector<HTMLImageElement>(".side-bet-review-logo"); if (!image) { image = document.createElement("img"); image.className = "team-logo side-bet-review-logo"; image.alt = ""; image.width = 30; image.height = 30; image.loading = "eager"; const strong = row.querySelector("strong"); if (strong) row.insertBefore(image, strong); else row.append(image); } if (image.src !== url) image.src = url; });
}

function bettorForTeam(bet: Bet, team?: string) {
  if (team === bet.creator_team) return { id: bet.creator_id, name: bet.creator?.display_name || "Player" };
  if (team === bet.offered_team) return { id: bet.accepted_by || responseTarget(bet)?.recipient_id || "", name: bet.accepted_by_profile?.display_name || responseTarget(bet)?.recipient?.display_name || "Opponent" };
  return null;
}
function ledgerPresentation(bet: Bet, userId: string) {
  const game = bet.game; const away = game?.away_team || bet.offered_team || "Away"; const home = game?.home_team || bet.creator_team || "Home"; const awayName = fallbackDisplayName(away, game?.league); const homeName = fallbackDisplayName(home, game?.league);
  const involvesUser = bet.creator_id === userId || bet.accepted_by === userId; const userTeam = bet.creator_id === userId ? bet.creator_team : bet.accepted_by === userId ? bet.offered_team : undefined; const favoriteTeam = Number(bet.creator_spread) < 0 ? bet.creator_team : Number(bet.offered_spread) < 0 ? bet.offered_team : bet.creator_team; const displayTeam = involvesUser ? userTeam : favoriteTeam; const displaySpread = displayTeam === bet.creator_team ? bet.creator_spread : bet.offered_spread;
  const title = displayTeam === away ? `${awayName} ${spreadText(displaySpread)} at ${homeName}` : `${awayName} at ${homeName} ${spreadText(displaySpread)}`;
  const person = (p: { id?: string; name?: string } | null) => p?.id === userId ? "You" : p?.name || "Player";
  return { displayTeam, title, names: `${person(bettorForTeam(bet, away))} vs ${person(bettorForTeam(bet, home))}` };
}
function renderLedger(payload: AppData, ledgerBets: Bet[]) {
  const ledger = document.querySelector<HTMLElement>(".ledger-list"); const userId = payload.currentUser?.id; if (!ledger || !userId) return;
  const rows = ledgerBets.filter((b) => b.status === "accepted" || b.status === "settled").sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const sig = rows.map((b) => `${b.id}:${b.status}:${b.result || ""}:${b.winner_id || ""}`).join("|");
  const expectedRuntimeRows = rows.length || 1;
  if (ledger.dataset.fullSideBetLedgerSignature === sig && ledger.querySelectorAll(".runtime-full-ledger").length === expectedRuntimeRows) return;
  ledger.dataset.fullSideBetLedgerSignature = sig;
  Array.from(ledger.children).forEach((node) => { if (node instanceof HTMLElement) node.hidden = true; }); ledger.querySelectorAll(".runtime-full-ledger").forEach((node) => node.remove());
  rows.forEach((bet) => { const x = ledgerPresentation(bet, userId); const row = document.createElement("div"); row.className = "ledger-row side-bet-ledger-row runtime-full-ledger"; row.dataset.sideBetId = bet.id; row.hidden = false; const logo = logoForTeam(bet.game, x.displayTeam);
    if (logo) { const image = document.createElement("img"); image.src = logo; image.alt = ""; image.className = "team-logo"; image.width = 34; image.height = 34; image.loading = "lazy"; row.append(image); } else { const fallback = document.createElement("div"); fallback.className = "team-logo fallback"; fallback.textContent = fallbackDisplayName(x.displayTeam, bet.game?.league).slice(0, 1); row.append(fallback); }
    const copy = document.createElement("div"); const title = document.createElement("strong"); title.textContent = x.title; const meta = document.createElement("p"); const status = bet.status === "accepted" ? "Accepted" : bet.result === "push" ? "Push" : bet.winner_id ? `${bet.winner_id === userId ? "You" : bet.winner_id === bet.creator_id ? bet.creator?.display_name || "Player" : bet.accepted_by_profile?.display_name || "Opponent"} Won` : "Settled"; meta.textContent = `${x.names} · ${status}`; copy.append(title, meta);
    const amount = document.createElement("strong"); const involvesUser = bet.creator_id === userId || bet.accepted_by === userId; if (bet.status === "settled" && involvesUser && bet.result !== "push" && bet.winner_id) { const won = bet.winner_id === userId; amount.className = won ? "money-pos" : "money-neg"; amount.textContent = `${won ? "+" : "-"}${stakeText(bet.amount)}`; } else { amount.className = "money-neutral"; amount.textContent = stakeText(bet.amount); } row.append(copy, amount); ledger.append(row);
  });
  if (!rows.length) { const empty = document.createElement("p"); empty.className = "muted runtime-full-ledger"; empty.textContent = "No side bets in the ledger yet."; ledger.append(empty); }
}

export default function SideBetDisplayGuard() {
  useEffect(() => {
    let stopped = false; let payload: AppData | null = null; let ledgerBets: Bet[] = []; let previousMode: BetMode | null = null; let acceptedShown: string[] = []; let reviewBetId: string | null = null; let applying = false; let refreshing = false; let forceModeRefresh = false;
    function activeMode(): BetMode | null { if (document.querySelector(".side-bet-card.mode-sent")) return "sent"; if (document.querySelector(".side-bet-card.mode-received")) return "received"; return null; }
    function hideCurrentList() { const list = document.querySelector<HTMLElement>(".side-bet-list"); if (list) list.style.visibility = "hidden"; }
    function apply() {
      if (stopped || applying || !payload?.currentUser?.id) return; applying = true;
      try { const userId = payload.currentUser.id; const mode = activeMode(); if (previousMode && previousMode !== mode && acceptedShown.length) addSeen(userId, acceptedShown); if (forceModeRefresh && mode) hideCurrentList(); else acceptedShown = mode ? renderCards(payload, mode, readSeen(userId)) : []; previousMode = mode; addReviewLogos(payload, reviewBetId); renderLedger(payload, ledgerBets); } finally { applying = false; }
    }
    async function refresh(force = false) {
      if (stopped || refreshing || document.visibilityState !== "visible") return; if (!document.querySelector(".side-bet-center, .ledger-list, .confirmation-sheet")) return; const token = window.localStorage.getItem("pickem_session_token"); if (!token) return; refreshing = true;
      try { const needsApp = Boolean(document.querySelector(".side-bet-center, .confirmation-sheet")) || !payload; const needsLedger = Boolean(document.querySelector(".ledger-list")); const [appResponse, ledgerResponse] = await Promise.all([needsApp ? fetch("/api/app-data", { headers: { Authorization: `Bearer ${token}`, "x-pickem-group": groupSlug() }, cache: "no-store" }) : Promise.resolve(null), needsLedger ? fetch("/api/side-bet-ledger", { headers: { Authorization: `Bearer ${token}`, "x-pickem-group": groupSlug() }, cache: "no-store" }) : Promise.resolve(null)]); if (appResponse?.ok) payload = await appResponse.json() as AppData; if (ledgerResponse?.ok) { const x = await ledgerResponse.json() as { sideBetLedger?: Bet[] }; ledgerBets = x.sideBetLedger || []; } forceModeRefresh = false; apply(); } catch { if (force) forceModeRefresh = false; } finally { refreshing = false; }
    }
    function captureReview(event: MouseEvent) { const target = event.target; if (!(target instanceof Element)) return; const button = target.closest("button"); if (!button || !/review\s*&?\s*accept/i.test(button.textContent || "")) return; const card = button.closest<HTMLElement>(".side-bet-card.mode-received"); if (card?.dataset.sideBetId) { reviewBetId = card.dataset.sideBetId; window.setTimeout(apply, 0); } }
    const observer = new MutationObserver(() => window.requestAnimationFrame(() => { const mode = activeMode(); if (payload && mode && mode !== previousMode) { forceModeRefresh = true; hideCurrentList(); void refresh(true); return; } apply(); }));
    const refreshOnResume = () => { void refresh(); };
    observer.observe(document.body, { subtree: true, childList: true, characterData: true }); document.addEventListener("click", captureReview, true); window.addEventListener("focus", refreshOnResume); document.addEventListener("visibilitychange", refreshOnResume); void refresh(); const timer = window.setInterval(() => void refresh(), 2500);
    return () => { if (payload?.currentUser?.id && previousMode && acceptedShown.length) addSeen(payload.currentUser.id, acceptedShown); stopped = true; observer.disconnect(); document.removeEventListener("click", captureReview, true); window.removeEventListener("focus", refreshOnResume); document.removeEventListener("visibilitychange", refreshOnResume); window.clearInterval(timer); };
  }, []);
  return null;
}
