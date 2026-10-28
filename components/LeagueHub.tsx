"use client";

import { useEffect, useState } from "react";
import { ArrowRight, LogOut, Trophy, UserRound } from "lucide-react";
import { clearClientSession, getClientSessionToken } from "@/lib/clientSession";
import type { LeagueMembership } from "@/lib/leagueAccess";

type MyLeaguesResponse = {
  ok: boolean;
  error?: string;
  profile?: { id: string; username: string; displayName: string };
  leagues?: LeagueMembership[];
};

export default function LeagueHub() {
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
        if (!controller.signal.aborted) setResult(response.ok ? payload : { ok: false, error: payload.error || "Could not load your leagues." });
      })
      .catch(() => { if (!controller.signal.aborted) setResult({ ok: false, error: "Could not connect. Try again in a moment." }); });
    return () => controller.abort();
  }, []);

  function signOut() {
    clearClientSession();
    window.location.replace("/leagues/login");
  }

  return <main className="league-hub-screen">
    <div className="league-hub-content">
      <header className="league-hub-topbar"><div className="league-hub-brand"><Trophy size={25} strokeWidth={2.5} /><span>PICK&apos;EM</span></div><button type="button" onClick={signOut} className="league-hub-signout"><LogOut size={16} /> Sign out</button></header>
      <section className="league-hub-intro">
        <span className="league-hub-eyebrow">YOUR PICK&apos;EM HOME</span>
        <h1>{result?.profile?.displayName ? `Hey, ${result.profile.displayName}.` : "Welcome back."}</h1>
        <p>Choose a league. Your picks, standings, and side bets stay separate in each one.</p>
      </section>
      {result?.ok && result.profile && <div className="league-hub-profile"><UserRound size={17} /><span>Signed in as <strong>{result.profile.displayName}</strong></span></div>}
      <section className="league-hub-list" aria-label="Your leagues">
        <h2>My leagues {result?.ok && <small>{result.leagues?.length || 0}</small>}</h2>
        {!result && <p className="league-hub-status" role="status">Loading your leagues…</p>}
        {result && !result.ok && <p className="league-hub-status error" role="alert">{result.error}</p>}
        {result?.ok && !result.leagues?.length && <p className="league-hub-status">No active leagues are assigned to this account. Ask Kameron to check your membership.</p>}
        {result?.leagues?.map((league) => <a className="league-hub-card" href={league.homePath} key={league.slug}>
          <span className={`league-hub-sport ${league.sport.toLowerCase()}`} aria-hidden="true">{league.sport === "Basketball" ? "🏀" : "🏈"}</span>
          <span className="league-hub-card-copy"><strong>{league.name}</strong><span>{league.sport} Pick&apos;em{league.role !== "member" ? " · Commissioner" : ""}</span></span>
          <ArrowRight size={20} aria-hidden="true" />
        </a>)}
      </section>
      <p className="league-hub-footer">One account. All your leagues.</p>
    </div>
  </main>;
}
