"use client";

import { memo, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
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
  } catch { /* Cache is optional. */ }
  return null;
}

function HeaderLeaguePicker({ activeSlug, displaySlug, currentTab, onSelect }: {
  activeSlug: PickemAppSlug; displaySlug?: PickemAppSlug;
  currentTab: LeagueTab; onSelect: (league: LeagueMembership) => void;
}) {
  const router = useRouter();
  const host = useRef<HTMLDivElement>(null);
  const navigationIntent = useRef(0);
  const [open, setOpen] = useState(false);
  const [leagues, setLeagues] = useState<LeagueMembership[] | null>(() => cachedLeagues());

  useEffect(() => () => { navigationIntent.current++; }, []);

  // Same cache and route/data warmup as Settings. Opening this menu does not
  // replace the header image or force a navigation/loading shell.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const token = getClientSessionToken();
    if (token) {
      void fetch("/api/my-leagues", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store", signal: controller.signal
      }).then(async response => response.ok ? response.json() : null)
        .then(data => {
          if (controller.signal.aborted || !Array.isArray(data?.leagues)) return;
          setLeagues(previous => JSON.stringify(previous) === JSON.stringify(data.leagues) ? previous : data.leagues);
          try {
            const profile = JSON.parse(window.localStorage.getItem("pickem_profile") || "null");
            window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ profileId: profile?.id || "", at: Date.now(), leagues: data.leagues }));
          } catch { /* caching optional */ }
        }).catch(() => undefined);
    }
    const onOutside = (event: PointerEvent) => {
      if (!host.current?.contains(event.target as Node)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      controller.abort();
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !leagues) return;
    for (const league of leagues) {
      if (league.slug !== activeSlug) router.prefetch(league.homePath);
    }
    for (const imagePath of ["/header-wordmark.png", "/football-pickem-wordmark.png", "/basketball-pickem-header-v2.png"]) {
      const picture = new window.Image();
      picture.src = imagePath;
      void picture.decode?.().catch(() => undefined);
    }
  }, [activeSlug, leagues, open, router]);

  function choose(league: LeagueMembership) {
    setOpen(false);
    const intent = ++navigationIntent.current;
    if (league.slug === activeSlug) {
      onSelect(league);
      return;
    }
    // Stage the same selected league that Settings stages, so the persistent
    // wordmark updates once and never flashes back to the prior league.
    onSelect(league);
    router.prefetch(league.homePath);
    void warmLeagueData(league.slug).catch(() => false).then(() => {
      if (navigationIntent.current !== intent) return;
      router.push(`${league.homePath}?view=${currentTab}`, { scroll: false });
    });
  }

  return <div className="header-league-picker" ref={host}>
    <button type="button" className="header-league-trigger" aria-label="Switch league"
      aria-expanded={open} aria-haspopup="listbox"
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0) return;
        event.preventDefault();
        setOpen(value => !value);
      }}
      onClick={event => { if (event.detail === 0) setOpen(value => !value); }}>
      <LeagueHeaderWordmark slug={displaySlug || activeSlug} />
    </button>
    {open && <div className="header-league-menu custom-select-menu" role="listbox" aria-label="Choose league">
      <span className="custom-select-group-label">My Leagues</span>
      {leagues?.map(league => <button type="button" role="option" aria-selected={league.slug === (displaySlug || activeSlug)}
        className={`custom-select-option ${league.slug === (displaySlug || activeSlug) ? "selected" : ""}`}
        key={league.slug} onClick={() => choose(league)}>
        <Image src={league.sport === "Basketball" ? "/league-basketball-orange.png" : "/league-football-brown.png"}
          alt="" width={20} height={20} unoptimized />
        <span className="header-league-option-name">{league.name}</span>
        {league.slug === (displaySlug || activeSlug) && <Check size={16} aria-hidden="true" />}
      </button>)}
      {!leagues && <p className="header-league-menu-loading">Loading leagues…</p>}
      {leagues?.length === 0 && <p className="header-league-menu-loading">No leagues available.</p>}
    </div>}
  </div>;
}

export default memo(HeaderLeaguePicker);
