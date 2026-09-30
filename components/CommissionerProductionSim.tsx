"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export default function CommissionerProductionSim() {
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const removeToolbar = () => document.querySelectorAll("vercel-live-feedback").forEach((node) => node.remove());
    removeToolbar();
    const observer = new MutationObserver(removeToolbar);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return <main className="prod-onboarding">
    <header className="prod-header">
      <div className="prod-header-inner">
        <div className="prod-brand"><Image src="/football-pickem-wordmark.png" alt="Football Pick'em" width={800} height={100} priority /></div>
        <div className="prod-header-actions"><button type="button" className="preview" onClick={() => setShowPreview(true)}>Preview App</button></div>
      </div>
    </header>
    <section className="prod-auth-shell">
      <div className="prod-auth-intro"><span className="prod-kicker">FOOTBALL PICK'EM</span><h1>Your league, built your way.</h1><p>Create an account, build a league, and invite everyone from one place.</p></div>
      <div className="prod-auth-card"><div className="prod-auth-copy"><span>NEW ACCOUNT</span><h2>Start your league.</h2><p>This is the future customer onboarding flow.</p></div><label className="prod-field"><span>Your name</span><input placeholder="Kameron Shaw" /></label><label className="prod-field"><span>Email</span><input placeholder="you@example.com" type="email" /></label><label className="prod-field"><span>Password</span><input placeholder="6+ characters" type="password" /></label><button type="button" className="prod-primary full">Create Account</button></div>
    </section>
    {showPreview && <div className="prod-preview-overlay"><div className="prod-preview-bar"><div><strong>Member App Preview</strong><span>Actual Pick'em app on isolated demo data.</span></div><button type="button" onClick={() => setShowPreview(false)}>Close</button></div><iframe src="/production-sim/demo" title="Football Pick'em member app preview" /></div>}
  </main>;
}
