"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LogOut } from "lucide-react";
import { clearClientSession, getClientSessionToken } from "@/lib/clientSession";
import type { LeagueMembership } from "@/lib/leagueAccess";
import { lastVisitedLeague } from "@/lib/lastLeague";

type MyLeaguesResponse = {
  ok: boolean;
  error?: string;
  profile?: { id: string; username: string; displayName: string };
  leagues?: LeagueMembership[];
};

export default function LeagueHub() {
  const router = useRouter();
  const [result, setResult] = useState<MyLeaguesResponse | null>(null);

  useEffect(() => {
    const token = getClientSessionToken();
    if (!token) {
      window.location.replace("/leagues/login");
      return;
    }
    const controller = new AbortController();
    fetch("/api/my-leagues", { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          clearClientSession();
          window.location.replace("/leagues/login");
          return;
        }
        const payload = await response.json() as MyLeaguesResponse;
        if (controller.signal.aborted) return;
        // Launching the installed app resumes the last authorized league; the
        // explicit league-home link (?chooser=1) always shows the full picker.
        if (response.ok && payload.ok && !new URLSearchParams(window.location.search).has("chooser")) {
          const lastSlug = lastVisitedLeague(payload.profile?.id || "");
          const lastLeague = payload.leagues?.find((item) => item.slug === lastSlug);
          if (lastLeague) {
            router.replace(lastLeague.homePath);
            return;
          }
        }
        setResult(response.ok ? payload : { ok: false, error: payload.error || "Could not load your leagues." });
      })
      .catch(() => { if (!controller.signal.aborted) setResult({ ok: false, error: "Could not connect. Try again in a moment." }); });
    return () => controller.abort();
  }, [router]);

  function signOut() {
    clearClientSession();
    window.location.replace("/leagues/login");
  }

  return <main className="league-hub-screen">
    <header className="scoreboard-header league-hub-header">
      <div className="scoreboard-main">
        <div className="brand-lockup">
          <Image className="header-wordmark league-hub-trophy-wordmark" src="/unified-pickem-wordmark.png" alt="Pick'em" width={800} height={225} unoptimized priority />
        </div>
        <div className="header-actions"><span className="header-refresh-indicator" aria-hidden="true" /><div className="header-slate">
          <button type="button" onClick={signOut} className="league-hub-signout"><LogOut size={16} /> Sign out</button>
        </div></div>
      </div>
    </header>
    <div className="league-hub-content">
      <section className="league-hub-intro" aria-labelledby="league-hub-title">
        <span className="league-hub-eyebrow">YOUR PICK&apos;EM HOME</span>
        <h1 id="league-hub-title">Choose your league</h1>
        <p>All your leagues in one place. Jump in to check picks, standings, and more.</p>
      </section>
      <section className="league-hub-list" aria-label="Your leagues">
        <h2>My Leagues</h2>
        {!result && <p className="league-hub-status" role="status">Loading your leagues…</p>}
        {result && !result.ok && <p className="league-hub-status error" role="alert">{result.error}</p>}
        {result?.ok && !result.leagues?.length && <p className="league-hub-status">No active leagues are assigned to this account. Ask Kameron to check your membership.</p>}
        {result?.leagues?.map((league) => <Link className="league-hub-card" href={league.homePath} key={league.slug}>
          <span className={`league-hub-sport ${league.sport.toLowerCase()}`} aria-hidden="true"><Image src={league.sport === "Basketball" ? "/league-basketball-orange.png" : "/league-football-brown.png"} alt="" width={54} height={54} unoptimized /></span>
          <span className="league-hub-card-copy"><strong>{league.name}</strong><span>{league.sport === "Basketball" ? "CBB/NBA" : "CFB/NFL"}</span></span>
          <span className="league-hub-open"><ArrowRight size={19} aria-hidden="true" /></span>
        </Link>)}
      </section>
    </div>
  </main>;
}
