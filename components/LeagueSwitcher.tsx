"use client";

import { useEffect, useState } from "react";
import { Check, ChevronRight, Layers3 } from "lucide-react";
import { getClientSessionToken } from "@/lib/clientSession";
import type { LeagueMembership } from "@/lib/leagueAccess";
import type { PickemAppSlug } from "@/lib/authUsers";

export default function LeagueSwitcher({ activeSlug }: { activeSlug: PickemAppSlug }) {
  const [leagues, setLeagues] = useState<LeagueMembership[] | null>(null);

  useEffect(() => {
    const token = getClientSessionToken();
    if (!token) return;
    const controller = new AbortController();
    fetch("/api/my-leagues", { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = await response.json();
        if (!controller.signal.aborted && Array.isArray(payload.leagues)) setLeagues(payload.leagues);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return <div className="settings-section settings-league-switcher">
    <h3>My Leagues</h3>
    <div className="settings-card">
      <div className="settings-row-heading"><div className="settings-leading-icon"><Layers3 size={17} /></div><div className="settings-row-copy"><strong>Switch League</strong><span>Only leagues you belong to are listed.</span></div></div>
      {leagues?.map((league) => <a key={league.slug} href={league.homePath} aria-current={league.slug === activeSlug ? "page" : undefined} className={`settings-league-link ${league.slug === activeSlug ? "active" : ""}`}>
        <span aria-hidden="true">{league.sport === "Basketball" ? "🏀" : "🏈"}</span><strong>{league.name}</strong>{league.slug === activeSlug ? <><small>Current</small><Check size={16} /></> : <ChevronRight size={17} />}
      </a>)}
      {!leagues && <div className="settings-league-loading">Loading leagues…</div>}
      <a className="settings-league-hub-link" href="/leagues">Open my league home <ChevronRight size={16} /></a>
    </div>
  </div>;
}
