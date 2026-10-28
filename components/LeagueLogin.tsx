"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import MenuSelect from "@/components/MenuSelect";
import { FAMILY_USERS } from "@/lib/authUsers";
import { getClientSessionToken, storeClientSession } from "@/lib/clientSession";

const choices = FAMILY_USERS.map((user) => ({ value: user.username, label: user.displayName })).sort((a, b) => a.label.localeCompare(b.label));

export default function LeagueLogin() {
  const [username, setUsername] = useState<string>(choices[0]?.value || "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getClientSessionToken();
    if (!token) { setChecking(false); return; }
    const controller = new AbortController();
    fetch("/api/my-leagues", { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, cache: "no-store" })
      .then((response) => { if (response.ok) window.location.replace("/leagues"); else if (!controller.signal.aborted) setChecking(false); })
      .catch(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, []);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, group: "all" })
      });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error || "Couldn't sign in."); return; }
      storeClientSession(payload.token, payload.profile);
      window.location.replace("/leagues");
    } catch {
      setError("Couldn't connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="league-hub-screen league-login-screen"><section className="league-login-card">
    <div className="league-hub-brand"><Trophy size={26} strokeWidth={2.5} /><span>PICK&apos;EM</span></div>
    <span className="league-hub-eyebrow">ONE ACCOUNT · ALL YOUR LEAGUES</span>
    <h1>Welcome back.</h1>
    <p>Sign in once to see every league you&apos;re in.</p>
    {checking ? <p className="league-hub-status" role="status">Checking your session…</p> : <form onSubmit={signIn}>
      <label>Name</label>
      <MenuSelect ariaLabel="Choose your name" className="input field-menu-select login-name-select" value={username} sections={[{ options: choices }]} onChange={setUsername} />
      <label htmlFor="unified-login-password">Password</label>
      <input id="unified-login-password" className="input" type="password" autoComplete="current-password" placeholder="Your existing Pick'em password" value={password} onChange={(event) => setPassword(event.target.value)} />
      {error && <p className="league-login-error" role="alert">{error}</p>}
      <button className="btn gold full" disabled={busy || password.length < 6}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>}
    <p className="league-login-note">Use the same name and password you already use in football or basketball.</p>
  </section></main>;
}
