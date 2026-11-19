"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import LeagueHeaderWordmark from "@/components/LeagueHeaderWordmark";
import { getClientSessionToken } from "@/lib/clientSession";
import { warmLeagueData } from "@/lib/leagueWarmup";
import type { LeagueMembership } from "@/lib/leagueAccess";
import type { LeagueTab } from "@/lib/leagueNavigation";
import type { PickemAppSlug } from "@/lib/authUsers";

const CACHE_KEY = "pickem_leagues_session_v1";
function cachedLeagues(): LeagueMembership[] | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(CACHE_KEY) || "null");
    const profile = JSON.parse(window.localStorage.getItem("pickem_profile") || "null");
    if (saved?.profileId && saved.profileId === profile?.id &&
      Date.now() - Number(saved.at || 0) < 30 * 60_000 &&
      Array.isArray(saved.leagues)) return saved.leagues;
  } catch { /* an optional optimization */ }
  return null;
}

export default function HeaderLeaguePicker({ activeSlug, displaySlug, currentTab }: { activeSlug: PickemAppSlug; displaySlug?: PickemAppSlug; currentTab: LeagueTab }) {
  const router = useRouter();
  const host = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [leagues, setLeagues] = useState<LeagueMembership[] | null>(() => cachedLeagues());

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const token = getClientSessionToken();
    if (token) {
      void fetch("/api/my-leagues", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal })
        .then(async response => response.ok ? response.json() : null)
        .then(data => {
          if (controller.signal.aborted || !Array.isArray(data?.leagues)) return;
          setLeagues(data.leagues);
          try {
            const profile = JSON.parse(window.localStorage.getItem("pickem_profile") || "null");
            window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ profileId: profile?.id || "", at: Date.now(), leagues: data.leagues }));
          } catch { /* caching optional */ }
        }).catch(() => undefined);
    }
    const handleOutside = (event: PointerEvent) => {
      if (!host.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      controller.abort();
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function choose(league: LeagueMembership) {
    setOpen(false);
    if (league.slug === activeSlug) return;
    router.prefetch(league.homePath);
    void warmLeagueData(league.slug).catch(() => undefined);
    router.push(`${league.homePath}?view=${currentTab}`, { scroll: false });
  }

  return <div className="header-league-picker" ref={host}>
    <button type="button" className="header-league-trigger" aria-label="Switch league" aria-expanded={open}
      aria-haspopup="menu" onClick={() => setOpen(value => !value)}>
      <LeagueHeaderWordmark slug={displaySlug || activeSlug} />
      <ChevronDown className="header-league-caret" size={14} aria-hidden="true" />
    </button>
    {open && <div className="header-league-menu" role="menu" aria-label="Choose league">
      <strong className="header-league-menu-heading">My Leagues</strong>
      {leagues?.map(league => <button type="button" role="menuitemradio" aria-checked={league.slug === activeSlug}
        key={league.slug} onClick={() => choose(league)}>
        <Image src={league.sport === "Basketball" ? "/league-basketball-orange.png" : "/league-football-brown.png"}
          alt="" width={20} height={20} unoptimized />
        <span>{league.name}</span>
        {league.slug === activeSlug && <Check size={17} aria-hidden="true" />}
      </button>)}
      {!leagues && <p className="header-league-menu-loading">Loading leagues…</p>}
      {leagues?.length === 0 && <p className="header-league-menu-loading">No leagues available.</p>}
    </div>}
  </div>;
}
