"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PickemApp from "@/components/PickemApp";
import RouteAppBootstrap from "@/components/RouteAppBootstrap";
import { clearClientSession, storeClientSession } from "@/lib/clientSession";

export default function DemoLeagueApp() {
  const [ready,setReady]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    let active=true;
    fetch("/api/universal/demo-session",{method:"POST"})
      .then(async(response)=>{
        const payload=await response.json();
        if(!response.ok) throw new Error(payload.error || "Could not open demo.");
        if(!active) return;
        storeClientSession(payload.token,payload.profile,false);
        setReady(true);
      })
      .catch((err)=>{ if(active) setError(err instanceof Error ? err.message : "Could not open demo."); });
    return()=>{ active=false; };
  },[]);

  if(!ready) return <div className="app-shell">
    <header className="scoreboard-header"><div className="scoreboard-main"><div className="brand-lockup"><img className="header-wordmark" src="/football-pickem-wordmark.png" alt="Football Pick'em"/></div><div className="header-actions"><div className="test-week-chip">DEMO</div></div></div></header>
    <main className="container"><div className={error ? "error-card" : "initial-loading"}>{error || "Opening demo…"}</div></main>
  </div>;

  return <div className="route-app group-demo">
    <RouteAppBootstrap slug="demo" />
    <Link href="/" className="demo-real-exit" onClick={()=>clearClientSession()}>Exit Demo</Link>
    <PickemApp appSlug="demo" />
  </div>;
}
