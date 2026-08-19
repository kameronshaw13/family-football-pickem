"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import MenuSelect from "@/components/MenuSelect";
import NumericText from "@/components/NumericText";

type LedgerBet = {
  id: string;
  week: number;
  creator_id: string;
  creator_team: string;
  offered_team: string;
  creator_spread: number | string;
  offered_spread: number | string;
  amount: number | string;
  status: string;
  result: string;
  winner_id?: string | null;
  accepted_by?: string | null;
  created_at?: string | null;
  creator?: { display_name?: string | null } | null;
  accepted_by_profile?: { display_name?: string | null } | null;
  game?: {
    away_team: string;
    home_team: string;
    away_logo_url?: string | null;
    home_logo_url?: string | null;
  } | null;
};

type LedgerPayload = {
  currentUser?: { id: string };
  week?: number;
  availableWeeks?: number[];
  sideBets?: LedgerBet[];
};

type PortalTargets = {
  controls: HTMLElement;
  list: HTMLElement;
};

const PREFS_KEY = "pickem_ui_preferences_v2";

function readLedgerWeek() {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(PREFS_KEY) || "{}") as { ledgerWeek?: number };
    return stored.ledgerWeek ?? null;
  } catch {
    return null;
  }
}

function saveLedgerWeek(week: number) {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(PREFS_KEY) || "{}") as Record<string, unknown>;
    window.sessionStorage.setItem(PREFS_KEY, JSON.stringify({ ...stored, ledgerWeek: week }));
  } catch {
    // Ledger filtering remains usable without session storage.
  }
}

function moneyText(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  return `${sign}$${absolute.toFixed(Number.isInteger(absolute) ? 0 : 2)}`;
}

function spreadText(value: number | string) {
  const spread = Number(value);
  if (!Number.isFinite(spread)) return "";
  if (spread === 0) return "Pick'em";
  return `${spread > 0 ? "+" : ""}${spread}`;
}

function teamLogo(bet: LedgerBet, team: string) {
  if (!bet.game) return null;
  return team === bet.game.home_team ? bet.game.home_logo_url || null : bet.game.away_logo_url || null;
}

function LedgerLogo({ bet, team }: { bet: LedgerBet; team: string | null }) {
  const url = team ? teamLogo(bet, team) : null;
  if (url) return <img src={url} alt="" className="team-logo" width={34} height={34} loading="lazy" decoding="async" />;
  return <div className="team-logo fallback">{team?.slice(0, 1) || "—"}</div>;
}

function LedgerRow({ bet, currentUserId }: { bet: LedgerBet; currentUserId: string }) {
  const favoriteTeam = Number(bet.creator_spread) < 0 ? bet.creator_team : Number(bet.offered_spread) < 0 ? bet.offered_team : bet.creator_team;
  const favoriteSpread = favoriteTeam === bet.creator_team ? Number(bet.creator_spread) : Number(bet.offered_spread);
  const otherTeam = favoriteTeam === bet.creator_team ? bet.offered_team : bet.creator_team;
  const coveredTeam = bet.result === "creator_win" ? bet.creator_team : bet.result === "acceptor_win" ? bet.offered_team : null;
  const creatorName = bet.creator?.display_name || "Player";
  const acceptorName = bet.accepted_by_profile?.display_name || "Opponent";
  const winnerName = bet.result === "creator_win" ? creatorName : bet.result === "acceptor_win" ? acceptorName : null;
  const stake = Number(bet.amount);
  const userWon = bet.winner_id === currentUserId || (!bet.winner_id && bet.result === "creator_win" && bet.creator_id === currentUserId) || (!bet.winner_id && bet.result === "acceptor_win" && bet.accepted_by === currentUserId);
  const involved = bet.creator_id === currentUserId || bet.accepted_by === currentUserId;
  const amount = bet.result === "push" || !involved ? 0 : userWon ? stake : -stake;

  return <div className="ledger-row side-bet-ledger-row">
    <LedgerLogo bet={bet} team={coveredTeam} />
    <div>
      <strong>{otherTeam} vs {favoriteTeam} <NumericText text={spreadText(favoriteSpread)} /></strong>
      <p>{creatorName} vs {acceptorName} · {winnerName ? `${winnerName} Wins` : "Push"}</p>
    </div>
    <strong className={amount > 0 ? "money-pos" : amount < 0 ? "money-neg" : "money-neutral"}><NumericText text={moneyText(amount)} /></strong>
  </div>;
}

async function fetchLedgerPayload() {
  const token = window.localStorage.getItem("pickem_session_token");
  if (!token) return null;
  try {
    const response = await fetch("/api/app-data", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });
    return response.ok ? await response.json() as LedgerPayload : null;
  } catch {
    return null;
  }
}

export default function SideBetLedgerEnhancement() {
  const [targets, setTargets] = useState<PortalTargets | null>(null);
  const [payload, setPayload] = useState<LedgerPayload | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  useEffect(() => {
    let frame = 0;
    let active = true;

    function attach() {
      if (!active) return;
      const heading = Array.from(document.querySelectorAll<HTMLElement>(".heading-with-badge")).find((item) => item.textContent?.includes("Side Bet Ledger"));
      const section = heading?.closest<HTMLElement>(".subsection.bank-section");
      const headingRow = heading?.closest<HTMLElement>(".standings-heading-row");
      const original = section?.querySelector<HTMLElement>(":scope > .ledger-list:not(.enhanced-ledger-list)");
      if (!section || !headingRow || !original) {
        if (targets && (!targets.controls.isConnected || !targets.list.isConnected)) setTargets(null);
        return;
      }

      original.hidden = true;
      original.style.setProperty("display", "none", "important");
      let controls = headingRow.querySelector<HTMLElement>("[data-ledger-week-controls]");
      if (!controls) {
        controls = document.createElement("div");
        controls.className = "ledger-week-controls";
        controls.dataset.ledgerWeekControls = "true";
        headingRow.appendChild(controls);
      }

      let list = section.querySelector<HTMLElement>("[data-ledger-filtered-list]");
      if (!list) {
        list = document.createElement("div");
        list.dataset.ledgerFilteredList = "true";
        original.insertAdjacentElement("afterend", list);
      }

      if (targets?.controls !== controls || targets?.list !== list) setTargets({ controls, list });
    }

    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(attach);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true });
    schedule();

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [targets]);

  useEffect(() => {
    if (!targets) return;
    let active = true;

    async function load() {
      const next = await fetchLedgerPayload();
      if (!active || !next) return;
      setPayload(next);
      const currentWeek = Number(next.week ?? 0);
      const weeks = next.availableWeeks || [];
      const preferred = readLedgerWeek();
      setSelectedWeek(preferred != null && weeks.includes(preferred) ? preferred : currentWeek);
    }

    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
    };
  }, [targets]);

  const weeks = useMemo(() => {
    if (!payload) return [];
    const currentWeek = Number(payload.week ?? 0);
    return Array.from(new Set((payload.availableWeeks || [currentWeek]).filter((week) => week <= currentWeek))).sort((a, b) => b - a);
  }, [payload]);

  const settled = useMemo(() => {
    if (!payload || selectedWeek == null) return [];
    return (payload.sideBets || [])
      .filter((bet) => bet.status === "settled" && Number(bet.week) === selectedWeek)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [payload, selectedWeek]);

  if (!targets || !payload || selectedWeek == null) return null;

  const controls = createPortal(
    <MenuSelect
      ariaLabel="Select side bet ledger week"
      className="standings-menu-select"
      value={String(selectedWeek)}
      sections={[{ options: weeks.map((week) => ({ value: String(week), label: week === 0 ? "Week 0" : `Week ${week}` })) }]}
      onChange={(value) => {
        const week = Number(value);
        setSelectedWeek(week);
        saveLedgerWeek(week);
      }}
    />,
    targets.controls
  );

  const list = createPortal(
    <div className="ledger-list enhanced-ledger-list">
      {!settled.length && <p className="muted">No settled side bets.</p>}
      {settled.map((bet) => <LedgerRow key={bet.id} bet={bet} currentUserId={payload.currentUser?.id || ""} />)}
    </div>,
    targets.list
  );

  return <>{controls}{list}</>;
}
