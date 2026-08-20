"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, Send } from "lucide-react";
import GroupMoneyControls from "@/components/GroupMoneyControls";
import NumericText from "@/components/NumericText";

type AppSlug = "other-family" | "friends";
type Payload = any;
const CACHE_PREFIX = "pickem_app_data_v1:";

function selectedWeek() {
  const trigger = document.querySelector<HTMLButtonElement>('button[aria-label="Select week"]');
  const match = (trigger?.textContent || "").match(/Week\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function latestPayload(slug: AppSlug): Payload | null {
  try {
    let best: { cachedAt: number; payload: Payload } | null = null;
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (!key?.startsWith(CACHE_PREFIX)) continue;
      const parsed = JSON.parse(window.sessionStorage.getItem(key) || "null");
      if (parsed?.payload?.activeGroup?.slug !== slug) continue;
      if (!best || Number(parsed.cachedAt || 0) > best.cachedAt) best = parsed;
    }
    return best?.payload || null;
  } catch {
    return null;
  }
}

function cachePayload(payload: Payload) {
  try {
    let updated = false;
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (!key?.startsWith(CACHE_PREFIX)) continue;
      const parsed = JSON.parse(window.sessionStorage.getItem(key) || "null");
      if (parsed?.payload?.activeGroup?.slug !== payload?.activeGroup?.slug) continue;
      parsed.payload = payload;
      parsed.cachedAt = Date.now();
      window.sessionStorage.setItem(key, JSON.stringify(parsed));
      updated = true;
    }
    if (!updated && payload?.activeGroup?.slug) {
      window.sessionStorage.setItem(
        `${CACHE_PREFIX}companion:${payload.activeGroup.slug}:${Number(payload.week || 0)}`,
        JSON.stringify({ cachedAt: Date.now(), payload })
      );
    }
  } catch {
    // Session storage is only an optimization.
  }
}

function clearCurrentCache(slug: AppSlug) {
  try {
    const remove: string[] = [];
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (!key?.startsWith(CACHE_PREFIX)) continue;
      const parsed = JSON.parse(window.sessionStorage.getItem(key) || "null");
      if (parsed?.payload?.activeGroup?.slug === slug) remove.push(key);
    }
    remove.forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // A normal reload will still request fresh data.
  }
}

function ensureHost(key: string, parent: Element | null, after?: Element | null) {
  if (!parent) return null;
  let host = parent.querySelector<HTMLElement>(`:scope > [data-companion-host="${key}"]`);
  if (host) return host;
  host = document.createElement("div");
  host.dataset.companionHost = key;
  if (after?.parentElement === parent) after.insertAdjacentElement("afterend", host);
  else parent.appendChild(host);
  return host;
}

function normalizeUrl(value: string | null | undefined) {
  try { return new URL(value || "", window.location.origin).href; }
  catch { return value || ""; }
}

function pointText(value: number) {
  return `${value} ${value === 1 ? "pt" : "pts"}`;
}

function replaceDogWinLabels() {
  const root = document.querySelector<HTMLElement>(".route-app.group-other-family");
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const value = node.nodeValue || "";
    if (/\+[123]W\b/.test(value)) {
      node.nodeValue = value.replace(/\+([123])W\b/g, (_, raw) => {
        const points = Number(raw);
        return `+${pointText(points)}`;
      });
    }
    node = walker.nextNode();
  }
}

function gameForCard(payload: Payload, card: HTMLElement) {
  const logo = card.querySelector<HTMLImageElement>("img.team-logo");
  const src = normalizeUrl(logo?.src);
  if (!src) return null;
  return (payload.games || []).find((game: any) => [game.away_logo_url, game.home_logo_url].some((url: string) => normalizeUrl(url) === src)) || null;
}

function syncConfidencePickCards(payload: Payload) {
  if (payload?.activeGroup?.slug !== "other-family") return;
  const section = document.querySelector<HTMLElement>(".card-panel .pick-section");
  if (!section) return;
  const currentUserId = payload.currentUser?.id;
  const week = Number(payload.week);
  const picks = (payload.picks || []).filter((pick: any) => pick.user_id === currentUserId && Number(pick.week) === week);

  section.querySelectorAll<HTMLElement>(":scope > .pick-card").forEach((card, index) => {
    const game = gameForCard(payload, card);
    const pick = game ? picks.find((item: any) => item.game_id === game.id) : null;
    card.querySelector(".confidence-card-chip")?.remove();
    if (!pick) {
      card.style.order = String(100 + index);
      return;
    }
    if (pick.pick_type === "underdog") {
      card.style.order = "1000";
      return;
    }
    const points = Number(pick.confidence_points || 0);
    card.style.order = String(points > 0 ? 10 - points : 50 + index);
    if (points > 0) {
      const market = card.querySelector<HTMLElement>(".pick-title-market") || card.querySelector<HTMLElement>(".pick-card-copy");
      if (market) {
        const chip = document.createElement("span");
        chip.className = "confidence-card-chip";
        chip.textContent = `· ${pointText(points)}`;
        market.append(chip);
      }
    }
  });
}

function rebuildPointsLeaderboard(leaderboard: HTMLElement, rows: any[]) {
  leaderboard.classList.add("points-mode");
  const labels = leaderboard.querySelector<HTMLElement>(":scope > .leaderboard-labels");
  if (labels) {
    labels.replaceChildren();
    for (const text of ["Place", "Player", "Points"]) {
      const span = document.createElement("span");
      span.textContent = text;
      labels.appendChild(span);
    }
  }

  const domRows = Array.from(leaderboard.querySelectorAll<HTMLElement>(":scope > .leaderboard-row"));
  const byName = new Map(domRows.map((row) => [row.querySelector(".leaderboard-player strong")?.textContent?.trim().toLowerCase() || "", row]));
  for (let index = 0; index < rows.length; index += 1) {
    const standing = rows[index];
    const row = byName.get(String(standing.display_name || "").trim().toLowerCase());
    if (!row) continue;
    row.querySelectorAll(":scope > .leaderboard-stat, :scope > .leaderboard-pct, :scope > .leaderboard-points").forEach((node) => node.remove());
    const rank = row.querySelector<HTMLElement>(".leaderboard-rank");
    if (rank) {
      rank.textContent = String(standing.rank || index + 1);
      rank.classList.remove("rank-1", "rank-2", "rank-3");
      if (Number(standing.rank) <= 3) rank.classList.add(`rank-${Number(standing.rank)}`);
    }
    const points = document.createElement("strong");
    points.className = "leaderboard-points";
    points.textContent = String(Number(standing.points || 0));
    row.appendChild(points);
    leaderboard.appendChild(row);
  }
}

function syncConfidenceStandings(payload: Payload) {
  if (payload?.activeGroup?.slug !== "other-family") return;
  document.querySelectorAll<HTMLElement>(".standings-panel .leaderboard").forEach((leaderboard) => {
    const weekly = Boolean(leaderboard.closest(".weekly-standings"));
    const rows = weekly
      ? payload.weeklyStandingsByWeek?.[String(payload.week)] || []
      : payload.standings || [];
    rebuildPointsLeaderboard(leaderboard, rows);
  });

  const results = document.querySelector<HTMLElement>(".standings-panel .bank-week-results");
  if (!results) return;
  const labels = results.querySelector<HTMLElement>(":scope > .bank-results-labels");
  if (labels) {
    labels.replaceChildren();
    for (const text of ["Player", "Balance", "Points", ""]) {
      const span = document.createElement("span");
      span.textContent = text;
      labels.appendChild(span);
    }
  }
  const weeklyRows = payload.weeklyStandingsByWeek?.[String(payload.week)] || [];
  const details = Array.from(results.querySelectorAll<HTMLElement>(":scope > .bank-player-result"));
  const byName = new Map(details.map((row) => [row.querySelector(".bank-result-player")?.textContent?.trim().toLowerCase() || "", row]));
  for (const standing of weeklyRows) {
    const row = byName.get(String(standing.display_name || "").trim().toLowerCase());
    if (!row) continue;
    const stat = row.querySelector<HTMLElement>(".bank-result-record");
    if (stat) stat.textContent = `${Number(standing.points || 0)} pts`;
    results.appendChild(row);
  }
}

function hideBaseRules() {
  const base = document.querySelector<HTMLElement>(".rules-panel > .rules-list");
  if (base) base.style.display = "none";
}

function prepareManualSideBetUi() {
  const sheet = document.querySelector<HTMLElement>(".side-bet-slip-sheet");
  if (!sheet) return { sheet: null, host: null };
  const amountSection = Array.from(sheet.querySelectorAll<HTMLElement>(".side-bet-slip-section"))
    .find((node) => node.querySelector(".side-bet-slip-section-head")?.textContent?.trim() === "Amount") || null;
  if (!amountSection) return { sheet, host: null };
  amountSection.querySelector<HTMLElement>(".side-bet-amount-grid")?.classList.add("companion-hidden-control");
  sheet.querySelector<HTMLButtonElement>(".side-bet-slip-submit")?.classList.add("companion-hidden-control");
  const head = amountSection.querySelector(".side-bet-slip-section-head");
  return { sheet, host: ensureHost("manual-side-bet", amountSection, head) };
}

function ConfidenceOrder({ payload, onPayload }: { payload: Payload; onPayload: (payload: Payload) => void }) {
  const currentUserId = payload.currentUser?.id;
  const week = Number(payload.week);
  const source = useMemo(
    () => (payload.picks || []).filter((pick: any) => pick.user_id === currentUserId && Number(pick.week) === week && pick.pick_type === "regular"),
    [currentUserId, payload.picks, week]
  );
  const initial = useMemo(() => [...source].sort((a, b) => {
    const pointDiff = Number(b.confidence_points || 0) - Number(a.confidence_points || 0);
    if (pointDiff) return pointDiff;
    const gameA = payload.games?.find((game: any) => game.id === a.game_id) || a.game;
    const gameB = payload.games?.find((game: any) => game.id === b.game_id) || b.game;
    return new Date(gameA?.commence_time || 0).getTime() - new Date(gameB?.commence_time || 0).getTime();
  }), [payload.games, source]);
  const [order, setOrder] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const locked = source.some((pick: any) => pick.status === "locked");

  useEffect(() => setOrder(initial), [initial]);

  async function persist(next: any[]) {
    setOrder(next);
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/confidence-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ week, gameIds: next.map((pick) => pick.game_id) })
      });
      const result = await response.json();
      if (!response.ok) {
        setOrder(initial);
        setMessage(result.error || "Could not save confidence order.");
        return;
      }
      const points = new Map((result.order || []).map((row: any) => [row.gameId, Number(row.points)]));
      const updated = {
        ...payload,
        picks: (payload.picks || []).map((pick: any) => points.has(pick.game_id) && pick.user_id === currentUserId
          ? { ...pick, confidence_points: points.get(pick.game_id) }
          : pick)
      };
      cachePayload(updated);
      onPayload(updated);
      window.dispatchEvent(new CustomEvent("pickem:companion-refresh"));
    } catch {
      setOrder(initial);
      setMessage("Could not save confidence order.");
    } finally {
      setSaving(false);
    }
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (locked || saving || target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    void persist(next);
  }

  if (!source.length) return null;
  return <section className="confidence-order-panel">
    <div className="confidence-order-head">
      <div><strong>Confidence Order</strong><small>Move picks here · 5 points is most confident</small></div>
      {saving && <span>Saving…</span>}
    </div>
    <div className="confidence-order-list">
      {order.map((pick: any, index) => {
        const points = Math.max(1, 5 - index);
        return <div className="confidence-order-row" key={pick.game_id}>
          <span className="confidence-value"><NumericText text={pointText(points)} /></span>
          <strong>{pick.selected_team}</strong>
          <div className="confidence-move">
            <button type="button" aria-label={`Move ${pick.selected_team} up`} disabled={locked || saving || index === 0} onClick={() => move(index, -1)}><ChevronUp size={16} /></button>
            <button type="button" aria-label={`Move ${pick.selected_team} down`} disabled={locked || saving || index === order.length - 1} onClick={() => move(index, 1)}><ChevronDown size={16} /></button>
          </div>
        </div>;
      })}
    </div>
    {locked && <p className="confidence-note">Confidence order is locked because a regular pick has locked.</p>}
    {message && <p className="confidence-error">{message}</p>}
  </section>;
}

function ManualSideBet({ slug, payload, sheet }: { slug: AppSlug; payload: Payload; sheet: HTMLElement }) {
  const [amount, setAmount] = useState("20");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function send() {
    const stake = Number(amount);
    if (!Number.isFinite(stake) || stake <= 0) {
      setMessage("Enter a side bet amount greater than $0.");
      return;
    }
    const selectedImg = sheet.querySelector<HTMLImageElement>(".side-bet-slip-selection img");
    const selectedSrc = normalizeUrl(selectedImg?.src);
    const game = (payload.games || []).find((item: any) => [item.home_logo_url, item.away_logo_url].some((url: string) => normalizeUrl(url) === selectedSrc));
    if (!game) {
      setMessage("Could not identify the selected game. Close the slip and choose the team again.");
      return;
    }
    const creatorTeam = normalizeUrl(game.home_logo_url) === selectedSrc ? game.home_team : game.away_team;
    const checkedLabels = Array.from(sheet.querySelectorAll<HTMLLabelElement>(".side-bet-recipient-grid label"))
      .filter((label) => label.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked);
    const recipientIds = checkedLabels.flatMap((label) => {
      const name = label.querySelector("span")?.textContent?.trim().toLowerCase();
      const profile = (payload.profiles || []).find((item: any) => item.display_name?.trim().toLowerCase() === name);
      return profile ? [profile.id] : [];
    });
    if (!recipientIds.length) {
      setMessage("Choose at least one person to send the bet to.");
      return;
    }
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/side-bets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "create", gameId: game.id, creatorTeam, amount: stake, recipientIds, viewWeek: payload.week })
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error || "Could not send the side bet.");
        return;
      }
      clearCurrentCache(slug);
      window.location.reload();
    } catch {
      setMessage("Could not send the side bet.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="companion-side-bet-amount">
    <label htmlFor={`companion-side-bet-amount-${slug}`}>Amount</label>
    <div className="companion-side-bet-input">
      <span>$</span>
      <input id={`companion-side-bet-amount-${slug}`} type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
    </div>
    <small className="companion-side-bet-hint">Enter any amount.</small>
    {message && <small className="companion-side-bet-error">{message}</small>}
    <button className="btn accent companion-side-bet-submit" type="button" disabled={saving} onClick={() => void send()}><Send size={15} /> {saving ? "Sending…" : "Send offer"}</button>
  </div>;
}

function FriendsMoneySummary() {
  return <section className="friends-money-summary">
    <div><span>Weekly</span><strong>1st +$20</strong><small>4th -$10 · 5th -$10</small></div>
    <div><span>Season</span><strong>1st +$150</strong><small>2nd $0 · 3rd–5th -$50</small></div>
  </section>;
}

function CompanionRules({ slug }: { slug: AppSlug }) {
  const other = slug === "other-family";
  const sections = other ? [
    ["Weekly Card", ["5 regular spread picks plus 1 underdog every week.", "Weeks 1–2 are college-only. Weeks 3–20 require at least 1 CFB and 1 NFL regular pick."]],
    ["Confidence Points", ["Rank the 5 regular picks in My Card from 5 points (most confident) to 1 point.", "A winning spread pick earns its confidence points. A loss or push earns 0 confidence points.", "Confidence order locks when the first regular pick locks."]],
    ["Underdog Bonus", ["The dog must win outright. +7 to +9.5 earns 1 extra point; +10 to +19.5 earns 2 extra points; +20 or more earns 3 extra points.", "A losing dog earns 0 points and does not subtract points."]],
    ["Standings", ["Weekly and season standings are ranked by total points.", "If points are tied, regular-pick wins, losses, then pushes are used before an exact tie remains."]],
    ["Money", ["Weekly and season prizes are winner-take-all.", "Caleb sets the current week's pot and the season pot in the Bank tab.", "If first place is tied, the tied winners split the winner-take-all pot."]],
    ["Side Bets", ["Spread bets only. Enter any positive dollar amount manually.", "There is no weekly side-bet count limit and no fixed dollar cap.", "Offers may be sent or accepted until kickoff."]]
  ] : [
    ["Weekly Card", ["Week 1: 3 regular picks plus 1 dog. Week 2 onward: 5 regular picks plus 1 dog.", "There is no CFB/NFL minimum. All regular picks may be college, all NFL, or any mix."]],
    ["Underdog", ["+7 to +9.5 = +1 win, +10 to +19.5 = +2 wins, +20 or more = +3 wins.", "The dog must win outright; a losing dog does not add a loss."]],
    ["Season Money", ["1st: +$150. 2nd: $0. 3rd: -$50. 4th: -$50. 5th: -$50.", "The normal standings tiebreak sequence is used. If a finishing position remains tied, the tied positions share those payouts evenly."]],
    ["Weekly Money", ["1st: +$20. 2nd: $0. 3rd: $0. 4th: -$10. 5th: -$10.", "The normal standings tiebreak sequence is used. If positions remain tied, those position payouts are shared evenly."]],
    ["Side Bets", ["Spread bets only. Enter any positive dollar amount manually.", "There is no weekly side-bet count limit and no fixed dollar cap.", "Offers may be sent or accepted until kickoff."]]
  ];
  return <div className="companion-rules-list">
    {sections.map(([title, items]: any) => <details className="rule-item" key={title}>
      <summary><strong>{title}</strong><ChevronDown className="rule-chevron" size={17} /></summary>
      <div className="rule-copy"><ul>{items.map((item: string) => <li key={item}><NumericText text={item} /></li>)}</ul></div>
    </details>)}
  </div>;
}

export default function CompanionAppEnhancements({ slug }: { slug: AppSlug }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [confidenceHost, setConfidenceHost] = useState<HTMLElement | null>(null);
  const [moneyHost, setMoneyHost] = useState<HTMLElement | null>(null);
  const [friendsMoneyHost, setFriendsMoneyHost] = useState<HTMLElement | null>(null);
  const [sideBetHost, setSideBetHost] = useState<HTMLElement | null>(null);
  const [sideBetSheet, setSideBetSheet] = useState<HTMLElement | null>(null);
  const [rulesHost, setRulesHost] = useState<HTMLElement | null>(null);
  const refreshingRef = useRef(false);

  const refreshPayload = useCallback(async () => {
    if (refreshingRef.current) return;
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) return;
    refreshingRef.current = true;
    try {
      const url = new URL("/api/app-data", window.location.origin);
      const week = selectedWeek();
      if (week != null) url.searchParams.set("week", String(week));
      const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok) return;
      const next = await response.json();
      if (next?.activeGroup?.slug !== slug) return;
      cachePayload(next);
      setPayload(next);
    } catch {
      // The base app remains usable if a companion refresh fails.
    } finally {
      refreshingRef.current = false;
    }
  }, [slug]);

  const apply = useCallback(() => {
    const nextPayload = latestPayload(slug);
    if (nextPayload) {
      setPayload(nextPayload);
      if (slug === "other-family") {
        syncConfidencePickCards(nextPayload);
        syncConfidenceStandings(nextPayload);
        replaceDogWinLabels();
      }
    }

    if (slug === "other-family") {
      const pickSection = document.querySelector(".card-panel .pick-section");
      const pickTitle = pickSection?.querySelector(":scope > h3") || null;
      setConfidenceHost(ensureHost("confidence", pickSection, pickTitle));
    }

    const bankPanel = document.querySelector<HTMLElement>(".standings-panel");
    const bankHeading = Array.from(bankPanel?.querySelectorAll<HTMLElement>(".scoreboard-heading") || [])
      .find((node) => node.textContent?.includes("Bank Balances")) || null;
    if (slug === "other-family") setMoneyHost(ensureHost("money", bankPanel, bankHeading));
    else setFriendsMoneyHost(ensureHost("friends-money", bankPanel, bankHeading));

    const rulesPanel = document.querySelector<HTMLElement>(".rules-panel");
    const ruleTitle = rulesPanel?.querySelector(".section-title") || null;
    if (rulesPanel) {
      hideBaseRules();
      setRulesHost(ensureHost("rules", rulesPanel, ruleTitle));
    }

    const manual = prepareManualSideBetUi();
    setSideBetSheet(manual.sheet);
    setSideBetHost(manual.host);
  }, [slug]);

  useEffect(() => {
    let active = true;
    const timers = new Set<number>();
    const schedule = (delay: number) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (active) apply();
      }, delay);
      timers.add(timer);
    };
    const scheduleRefresh = (delay: number) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (active) void refreshPayload();
      }, delay);
      timers.add(timer);
    };
    const burst = () => [0, 60, 180, 450, 900, 1500].forEach(schedule);
    [0, 160, 500, 1000, 1800, 3000].forEach(schedule);
    scheduleRefresh(550);

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const relevant = target.closest(".primary-nav button, .section-tabs button, .custom-select-option, .team-row.selectable, .pick-row-actions button, .side-bet-slip-bar, .side-bet-card .actions button, .confirmation-actions button, .confidence-move button");
      if (!relevant) return;
      burst();
      scheduleRefresh(target.closest(".team-row.selectable, .pick-row-actions button") ? 700 : 220);
    };
    const onRefresh = () => {
      burst();
      scheduleRefresh(120);
    };
    const onFocus = () => {
      burst();
      scheduleRefresh(100);
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      burst();
      scheduleRefresh(100);
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("pickem:companion-refresh", onRefresh);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      active = false;
      timers.forEach((timer) => window.clearTimeout(timer));
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("pickem:companion-refresh", onRefresh);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [apply, refreshPayload]);

  useEffect(() => {
    if (!payload) return;
    if (slug === "other-family") {
      syncConfidencePickCards(payload);
      syncConfidenceStandings(payload);
      replaceDogWinLabels();
    }
  }, [payload, slug]);

  return <>
    {slug === "other-family" && payload && confidenceHost && createPortal(<ConfidenceOrder payload={payload} onPayload={setPayload} />, confidenceHost)}
    {slug === "other-family" && payload?.groupMoney && moneyHost && createPortal(
      <GroupMoneyControls
        week={Number(payload.week)}
        weeklyAmount={Number(payload.groupMoney.weeklyAmount || 0)}
        seasonAmount={Number(payload.groupMoney.seasonAmount || 0)}
        canEdit={Boolean(payload.groupMoney.canEdit)}
        managerName={payload.groupMoney.managerName || "Caleb"}
        onSaved={(weeklyAmount, seasonAmount) => {
          const updated = { ...payload, groupMoney: { ...payload.groupMoney, weeklyAmount, seasonAmount } };
          cachePayload(updated);
          setPayload(updated);
        }}
        onError={() => undefined}
      />,
      moneyHost
    )}
    {slug === "friends" && friendsMoneyHost && createPortal(<FriendsMoneySummary />, friendsMoneyHost)}
    {payload && sideBetHost && sideBetSheet && createPortal(<ManualSideBet slug={slug} payload={payload} sheet={sideBetSheet} />, sideBetHost)}
    {rulesHost && createPortal(<CompanionRules slug={slug} />, rulesHost)}
  </>;
}
