"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Layers3 } from "lucide-react";
import { getClientSessionToken } from "@/lib/clientSession";
import { writeCachedAppData, type AppData } from "@/components/PickemPresentationShared";
import type { LeagueMembership } from "@/lib/leagueAccess";
import type { PickemAppSlug } from "@/lib/authUsers";

async function warmLeagueData(league: LeagueMembership) {
  const token = getClientSessionToken();
  if (!token) return;
  try {
    const response = await fetch("/api/app-data", {
      headers: { Authorization: `Bearer ${token}`, "x-pickem-group": league.slug },
      cache: "no-store"
    });
    if (response.ok && token === getClientSessionToken()) {
      writeCachedAppData(league.slug, null, await response.json() as AppData);
    }
  } catch {
    // Normal navigation still works if warming this league fails.
  }
}

export default function LeagueSwitcher({ activeSlug, selectedSlug, onSelect }: {
  activeSlug: PickemAppSlug;
  selectedSlug: PickemAppSlug;
  onSelect: (league: LeagueMembership) => void;
}) {
  const router = useRouter();
  const [leagues, setLeagues] = useState<LeagueMembership[] | null>(null);

  useEffect(() => {
    const token = getClientSessionToken();
    if (!token) return;
    const controller = new AbortController();
    fetch("/api/my-leagues", { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = await response.json();
        if (!controller.signal.aborted && Array.isArray(payload.leagues)) {
          setLeagues(payload.leagues);
          for (const league of payload.leagues as LeagueMembership[]) {
            if (league.slug !== activeSlug) router.prefetch(league.homePath);
          }
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [activeSlug, router]);

  function selectLeague(league: LeagueMembership) {
    onSelect(league);
    if (league.slug !== activeSlug) {
      router.prefetch(league.homePath);
      void warmLeagueData(league);
    }
  }

  return <div className="settings-section settings-league-switcher">
    <h3>My Leagues</h3>
    <div className="settings-card">
      <div className="settings-row-heading"><div className="settings-leading-icon"><Layers3 size={17} /></div><div className="settings-row-copy"><strong>Switch League</strong><span>Choose which league to view.</span></div></div>
      {leagues?.map((league) => <button key={league.slug} type="button" onClick={() => selectLeague(league)} aria-pressed={league.slug === selectedSlug} className={`settings-league-link ${league.slug === selectedSlug ? "active" : ""}`}>
        <span className={`settings-league-sport-mark ${league.sport.toLowerCase()}`} aria-hidden="true"><Image src={league.sport === "Basketball" ? "/league-basketball-orange.png" : "/league-football-brown.png"} alt="" width={22} height={22} unoptimized /></span><strong>{league.name}</strong>{league.slug === selectedSlug ? <><small>{league.slug === activeSlug ? "Current" : "Selected"}</small><Check size={16} /></> : <ChevronRight size={17} />}
      </button>)}
      {!leagues && <div className="settings-league-loading">Loading leagues…</div>}
      <Link className="settings-league-hub-link" href="/leagues">Open my league home <ChevronRight size={16} /></Link>
    </div>
  </div>;
}
