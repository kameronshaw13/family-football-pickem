"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import MenuSelect from "@/components/MenuSelect";

type LedgerBet = { week: number; status: string };
type CachedPayload = {
  week?: number;
  availableWeeks?: number[];
  sideBets?: LedgerBet[];
};
type CacheEntry = { cachedAt?: number; payload?: CachedPayload };

const CACHE_PREFIX = "pickem_app_data_v1:";

function latestCachedPayload() {
  let latest: { cachedAt: number; payload: CachedPayload } | null = null;
  try {
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (!key?.startsWith(CACHE_PREFIX)) continue;
      const entry = JSON.parse(window.sessionStorage.getItem(key) || "null") as CacheEntry | null;
      if (!entry?.payload) continue;
      const cachedAt = Number(entry.cachedAt || 0);
      if (!latest || cachedAt > latest.cachedAt) latest = { cachedAt, payload: entry.payload };
    }
  } catch {
    return null;
  }
  return latest?.payload || null;
}

function sideBetLedgerElements() {
  const heading = Array.from(document.querySelectorAll<HTMLElement>(".heading-with-badge"))
    .find((item) => item.textContent?.includes("Side Bet Ledger"));
  const section = heading?.closest<HTMLElement>(".subsection.bank-section");
  const headingRow = heading?.closest<HTMLElement>(".standings-heading-row");
  const list = section?.querySelector<HTMLElement>(":scope > .ledger-list");
  return { headingRow: headingRow || null, list: list || null };
}

export default function SideBetLedgerWeekFilter() {
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [headingTarget, setHeadingTarget] = useState<HTMLElement | null>(null);
  const [payload, setPayload] = useState<CachedPayload | null>(null);

  useEffect(() => {
    let timer = 0;
    let listObserver: MutationObserver | null = null;
    let observedList: HTMLElement | null = null;

    function resetList(list: HTMLElement | null) {
      if (!list) return;
      list.querySelectorAll<HTMLElement>(":scope > .side-bet-ledger-row").forEach((row) => { row.hidden = false; });
      list.querySelector<HTMLElement>(":scope > .ledger-week-empty")?.remove();
      const originalEmpty = list.querySelector<HTMLElement>(":scope > p.muted:not(.ledger-week-empty)");
      if (originalEmpty) {
        originalEmpty.hidden = false;
        originalEmpty.textContent = "No settled side bets.";
      }
    }

    function applyFilter() {
      const { headingRow, list } = sideBetLedgerElements();
      if (document.querySelector(".test-mode-banner")) {
        if (observedList && observedList !== list) resetList(observedList);
        resetList(list);
        setHeadingTarget(null);
        return;
      }
      if (!headingRow || !list) {
        setHeadingTarget(null);
        return;
      }

      if (headingTarget !== headingRow) setHeadingTarget(headingRow);
      if (observedList !== list) {
        listObserver?.disconnect();
        observedList = list;
        listObserver = new MutationObserver(() => applyFilter());
        listObserver.observe(list, { childList: true });
      }

      const nextPayload = latestCachedPayload();
      if (!nextPayload) return;
      setPayload((current) => current === nextPayload ? current : nextPayload);
      const currentWeek = Number(nextPayload.week ?? 0);
      const weeks = Array.from(new Set((nextPayload.availableWeeks || [currentWeek]).map(Number))).sort((a, b) => b - a);
      const activeWeek = selectedWeek != null && weeks.includes(selectedWeek) ? selectedWeek : currentWeek;
      if (selectedWeek !== activeWeek) {
        setSelectedWeek(activeWeek);
        return;
      }

      const settled = (nextPayload.sideBets || []).filter((bet) => bet.status === "settled");
      const rows = Array.from(list.querySelectorAll<HTMLElement>(":scope > .side-bet-ledger-row"));
      let visibleRows = 0;
      rows.forEach((row, index) => {
        const bet = settled[index];
        const visible = !bet || Number(bet.week) === activeWeek;
        row.hidden = !visible;
        if (visible) visibleRows += 1;
      });

      const originalEmpty = list.querySelector<HTMLElement>(":scope > p.muted:not(.ledger-week-empty)");
      if (originalEmpty) {
        originalEmpty.textContent = "No settled side bets.";
        originalEmpty.hidden = settled.length > 0;
      }
      const existingEmpty = list.querySelector<HTMLElement>(":scope > .ledger-week-empty");
      if (visibleRows === 0 && settled.length > 0) {
        if (!existingEmpty) {
          const empty = document.createElement("p");
          empty.className = "muted ledger-week-empty";
          empty.textContent = "No settled side bets.";
          list.appendChild(empty);
        }
      } else {
        existingEmpty?.remove();
      }
    }

    function schedule(delay = 0) {
      window.clearTimeout(timer);
      timer = window.setTimeout(applyFilter, delay);
    }

    const onClick = () => schedule(80);
    const onFocus = () => schedule(0);
    const onVisibility = () => { if (document.visibilityState === "visible") schedule(0); };
    document.addEventListener("click", onClick, true);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    schedule(0);

    return () => {
      window.clearTimeout(timer);
      listObserver?.disconnect();
      resetList(observedList);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [headingTarget, selectedWeek]);

  const weeks = useMemo(() => {
    const currentWeek = Number(payload?.week ?? 0);
    return Array.from(new Set((payload?.availableWeeks || [currentWeek]).map(Number))).sort((a, b) => b - a);
  }, [payload]);

  if (!headingTarget || selectedWeek == null || !weeks.length) return null;

  return createPortal(
    <MenuSelect
      ariaLabel="Select side bet ledger week"
      className="standings-menu-select"
      value={String(selectedWeek)}
      sections={[{ options: weeks.map((week) => ({ value: String(week), label: week === 0 ? "Week 0" : `Week ${week}` })) }]}
      onChange={(value) => setSelectedWeek(Number(value))}
    />,
    headingTarget
  );
}
