"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, Send } from "lucide-react";
import GroupMoneyControls from "@/components/GroupMoneyControls";
import NumericText from "@/components/NumericText";

type AppSlug = "other-family" | "friends";
type Payload = any;
const CACHE_PREFIX = "pickem_app_data_v1:";

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
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (!key?.startsWith(CACHE_PREFIX)) continue;
      const parsed = JSON.parse(window.sessionStorage.getItem(key) || "null");
      if (parsed?.payload?.activeGroup?.slug !== payload?.activeGroup?.slug) continue;
      parsed.payload = payload;
      parsed.cachedAt = Date.now();
      window.sessionStorage.setItem(key, JSON.stringify(parsed));
    }
  } catch {
    // UI continues to work if session storage is unavailable.
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
    // Reload still refreshes server data.
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
  try { return new URL(value || "", window.location.origin).href; } catch { return value || ""; }
}

function ConfidenceOrder({ payload, onPayload }: { payload: Payload; onPayload: (payload: Payload) => void }) {
  const currentUserId = payload.currentUser?.id;
  const week = Number(payload.week);
  const source = useMemo(() => (payload.picks || []).filter((pick: any) => pick.user_id === currentUserId && Number(pick.week) === week && pick.pick_type === "regular"), [currentUserId, payload.picks, week]);
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
      const points = new Map((result.order || []).map((row: any) => [row.gameId, row.points]));
      const updated = { ...payload, picks: (payload.picks || []).map((pick: any) => points.has(pick.game_id) && pick.user_id === currentUserId ? { ...pick, confidence_points: points.get(pick.game_id) } : pick) };
      cachePayload(updated);
      onPayload(updated);
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
    <div className="confidence-order-head"><div><strong>Confidence Order</strong><small>5 points = most confident</small></div>{saving && <span>Saving…</span>}</div>
    <div className="confidence-order-list">{order.map((pick: any, index) => <div className="confidence-order-row" key={pick.game_id}>
      <span className="confidence-value"><NumericText text={`${Math.max(1, 5 - index)} pts`} /></span>
      <strong>{pick.selected_team}</strong>
      <div className="confidence-move"><button type="button" aria-label={`Move ${pick.selected_team} up`} disabled={locked || saving || index === 0} onClick={() => move(index, -1)}><ChevronUp size={16} /></button><button type="button" aria-label={`Move ${pick.selected_team} down`} disabled={locked || saving || index === order.length - 1} onClick={() => move(index, 1)}><ChevronDown size={16} /></button></div>
    </div>)}</div>
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
    if (!Number.isFinite(stake) || stake <= 0) return setMessage("Enter a side bet amount greater than $0.");
    const selectedImg = sheet.querySelector<HTMLImageElement>(".side-bet-slip-selection img");
    const selectedSrc = normalizeUrl(selectedImg?.src);
    const game = (payload.games || []).find((item: any) => [item.home_logo_url, item.away_logo_url].some((url: string) => normalizeUrl(url) === selectedSrc));
    if (!game) return setMessage("Could not identify the selected game. Close the slip and choose the team again.");
    const creatorTeam = normalizeUrl(game.home_logo_url) === selectedSrc ? game.home_team : game.away_team;
    const checkedLabels = Array.from(sheet.querySelectorAll<HTMLLabelElement>(".side-bet-recipient-grid label")).filter((label) => label.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked);
    const recipientIds = checkedLabels.flatMap((label) => {
      const name = label.querySelector("span")?.textContent?.trim().toLowerCase();
      const profile = (payload.profiles || []).find((item: any) => item.display_name?.trim().toLowerCase() === name);
      return profile ? [profile.id] : [];
    });
    if (!recipientIds.length) return setMessage("Choose at least one person to send the bet to.");
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
      if (!response.ok) return setMessage(result.error || "Could not send the side bet.");
      clearCurrentCache(slug);
      window.location.reload();
    } catch {
      setMessage("Could not send the side bet.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="companion-side-bet-amount">
    <label htmlFor="companion-side-bet-amount">Amount</label>
    <div className="companion-side-bet-input"><span>$</span><input id="companion-side-bet-amount" type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
    {message && <small className="companion-side-bet-error">{message}</small>}
    <button className="btn accent companion-side-bet-submit" type="button" disabled={saving} onClick={() => void send()}><Send size={15} /> {saving ? "Sending…" : "Send offer"}</button>
  </div>;
}

function CompanionRules({ slug }: { slug: AppSlug }) {
  const other = slug === "other-family";
  const sections = other ? [
    ["Weekly Card", ["5 regular spread picks plus 1 underdog every week.", "Weeks 1–2 are college-only. Weeks 3–20 require at least 1 CFB and 1 NFL regular pick."]],
    ["Confidence Points", ["Rank the 5 regular picks in My Card from 5 points (most confident) to 1 point.", "A winning spread pick earns its confidence points. A loss earns 0 points.", "Confidence order locks when the first regular pick locks."]],
    ["Underdog Bonus", ["The dog must win outright. +7 to +9.5 earns 1 extra point; +10 to +19.5 earns 2; +20 or more earns 3.", "A losing dog earns 0 points."]],
    ["Standings", ["Weekly and season standings are ranked by total points."]],
    ["Money", ["Weekly and season prizes are winner-take-all.", "Caleb sets the weekly pot and season pot in the Bank tab.", "If first place is tied, the tied winners split the winner-take-all pot."]],
    ["Side Bets", ["Spread bets only. Enter any positive dollar amount manually.", "There is no weekly side-bet slot limit and no fixed dollar cap.", "Offers may be sent or accepted until kickoff."]]
  ] : [
    ["Weekly Card", ["Week 1: 3 regular picks plus 1 dog. Week 2 onward: 5 regular picks plus 1 dog.", "There is no CFB/NFL minimum. All regular picks may be college, all NFL, or any mix."]],
    ["Underdog", ["Same dog rules as the base app: +7 to +9.5 = +1 win, +10 to +19.5 = +2 wins, +20 or more = +3 wins.", "The dog must win outright; a losing dog does not add a loss."]],
    ["Season Money", ["1st: +$150. 2nd: $0. 3rd: -$50. 4th: -$50. 5th: -$50.", "Ties share the average payout of the tied finishing positions so the league remains net $0."]],
    ["Weekly Money", ["1st: +$20. 2nd: $0. 3rd: $0. 4th: -$10. 5th: -$10.", "The existing standings tiebreak sequence still determines ordering; unresolved ties share the tied-position payouts."]],
    ["Side Bets", ["Spread bets only. Enter any positive dollar amount manually.", "There is no weekly side-bet slot limit and no fixed dollar cap.", "Offers may be sent or accepted until kickoff."]]
  ];
  return <div className="companion-rules-list">{sections.map(([title, items]: any) => <details className="rule-item" key={title}><summary><strong>{title}</strong><ChevronDown className="rule-chevron" size={17} /></summary><div className="rule-copy"><ul>{items.map((item: string) => <li key={item}><NumericText text={item} /></li>)}</ul></div></details>)}</div>;
}

export default function CompanionAppEnhancements({ slug }: { slug: AppSlug }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [confidenceHost, setConfidenceHost] = useState<HTMLElement | null>(null);
  const [moneyHost, setMoneyHost] = useState<HTMLElement | null>(null);
  const [sideBetHost, setSideBetHost] = useState<HTMLElement | null>(null);
  const [sideBetSheet, setSideBetSheet] = useState<HTMLElement | null>(null);
  const [rulesHost, setRulesHost] = useState<HTMLElement | null>(null);

  const apply = useCallback(() => {
    const nextPayload = latestPayload(slug);
    if (nextPayload) setPayload(nextPayload);

    if (slug === "other-family") {
      const pickSection = document.querySelector(".card-panel .pick-section");
      const title = pickSection?.querySelector(":scope > h3") || null;
      setConfidenceHost(ensureHost("confidence", pickSection, title));
      const bankPanel = document.querySelector(".standings-panel");
      const bankHeading = Array.from(bankPanel?.querySelectorAll(".scoreboard-heading") || []).find((node) => node.textContent?.includes("Bank Balances")) || null;
      setMoneyHost(ensureHost("money", bankPanel, bankHeading));
    }

    const rulesPanel = document.querySelector(".rules-panel");
    const ruleTitle = rulesPanel?.querySelector(".section-title") || null;
    setRulesHost(ensureHost("rules", rulesPanel, ruleTitle));

    const sheet = document.querySelector<HTMLElement>(".side-bet-slip-sheet");
    const amountSection = sheet ? Array.from(sheet.querySelectorAll<HTMLElement>(".side-bet-slip-section")).find((node) => node.querySelector(".side-bet-slip-section-head")?.textContent?.trim() === "Amount") || null : null;
    const amountHead = amountSection?.querySelector(".side-bet-slip-section-head") || null;
    setSideBetSheet(sheet);
    setSideBetHost(ensureHost("manual-side-bet", amountSection, amountHead));

    const standingsPayload = nextPayload || payload;
    if (standingsPayload && slug === "other-family") {
      document.querySelectorAll<HTMLElement>(".leaderboard").forEach((leaderboard) => {
        const weekly = Boolean(leaderboard.closest(".weekly-standings"));
        const rows = weekly ? standingsPayload.weeklyStandingsByWeek?.[String(standingsPayload.week)] || [] : standingsPayload.standings || [];
        const byName = new Map(rows.map((row: any) => [String(row.display_name).trim().toLowerCase(), Number(row.points || 0)]));
        leaderboard.dataset.confidenceStandings = "true";
        leaderboard.querySelectorAll<HTMLElement>(".leaderboard-row").forEach((row) => {
          const name = row.querySelector(".leaderboard-player strong")?.textContent?.trim().toLowerCase();
          row.dataset.points = String(name ? byName.get(name) ?? 0 : 0);
        });
      });
    }
  }, [payload, slug]);

  useEffect(() => {
    let scheduled = 0;
    const schedule = () => {
      window.clearTimeout(scheduled);
      scheduled = window.setTimeout(apply, 40);
    };
    apply();
    const observer = new MutationObserver(schedule);
    const root = document.querySelector(".route-app") || document.body;
    observer.observe(root, { childList: true, subtree: true });
    const timer = window.setInterval(apply, 900);
    const acceptReload = (event: Event) => {
      const button = (event.target as Element | null)?.closest(".confirmation-actions .btn.accept");
      if (!button) return;
      window.setTimeout(() => { clearCurrentCache(slug); window.location.reload(); }, 1200);
    };
    document.addEventListener("click", acceptReload, true);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      window.clearTimeout(scheduled);
      document.removeEventListener("click", acceptReload, true);
    };
  }, [apply, slug]);

  return <>
    {slug === "other-family" && payload && confidenceHost && createPortal(<ConfidenceOrder payload={payload} onPayload={setPayload} />, confidenceHost)}
    {slug === "other-family" && payload?.groupMoney && moneyHost && createPortal(<GroupMoneyControls week={Number(payload.week)} weeklyAmount={Number(payload.groupMoney.weeklyAmount || 0)} seasonAmount={Number(payload.groupMoney.seasonAmount || 0)} canEdit={Boolean(payload.groupMoney.canEdit)} managerName={payload.groupMoney.managerName || "Caleb"} onSaved={(weeklyAmount, seasonAmount) => { const updated = { ...payload, groupMoney: { ...payload.groupMoney, weeklyAmount, seasonAmount } }; cachePayload(updated); setPayload(updated); }} onError={() => undefined} />, moneyHost)}
    {payload && sideBetHost && sideBetSheet && createPortal(<ManualSideBet slug={slug} payload={payload} sheet={sideBetSheet} />, sideBetHost)}
    {rulesHost && createPortal(<CompanionRules slug={slug} />, rulesHost)}
  </>;
}
