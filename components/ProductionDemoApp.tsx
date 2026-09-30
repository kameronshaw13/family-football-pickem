"use client";

import { useEffect, useState } from "react";
import PickemApp from "@/components/PickemApp";
import RouteAppBootstrap from "@/components/RouteAppBootstrap";
import { storeClientSession } from "@/lib/clientSession";

export default function ProductionDemoApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/production-sim/demo-session", { method: "POST", cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not start the demo.");
        storeClientSession(payload.token, payload.profile);
        if (active) setReady(true);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Could not start the demo."); });
    return () => { active = false; };
  }, []);

  if (error) return <main className="app-shell login-screen login-friends"><section className="login-card"><div className="login-app-name">Football Pick'em</div><h1>Demo unavailable</h1><p>{error}</p></section></main>;
  if (!ready) return <div className="app-shell loading-shell"><header className="scoreboard-header"><div className="scoreboard-main"><div className="brand-lockup"><img className="header-wordmark" src="/football-pickem-wordmark.png" alt="Football Pick'em" /></div></div></header><main className="initial-loading" role="status">Loading app…</main></div>;

  return <div className="route-app group-development"><RouteAppBootstrap slug="development" /><PickemApp appSlug="development" /></div>;
}
