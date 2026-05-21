"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import { usernameToEmail } from "@/lib/authUsers";

const usernames = ["kameron", "mike", "quentin"];

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "claim">("signin");
  const [username, setUsername] = useState("kameron");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setMessage("Supabase env vars are missing in Vercel.");
      setLoading(false);
      return;
    }
    const email = usernameToEmail(username);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    else window.location.href = "/";
    setLoading(false);
  }

  async function claim(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/auth/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error || "Could not claim account.");
      setLoading(false);
      return;
    }
    setMode("signin");
    setMessage("Account claimed. Sign in with that username and password.");
    setLoading(false);
  }

  return <main className="app-shell login-screen">
    <section className="login-card">
      <h1>{mode === "claim" ? "Claim your account" : "Sign in"}</h1>
      <p>{mode === "claim" ? "Pick your username and create your own password. You only do this once." : "Use your private family username and password."}</p>

      <div className="mode-toggle"><button type="button" className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")}>Sign in</button><button type="button" className={mode === "claim" ? "active" : ""} onClick={() => setMode("claim")}>First time</button></div>

      <form onSubmit={mode === "claim" ? claim : signIn}>
        <label>Username</label>
        <select className="input" value={username} onChange={(e) => setUsername(e.target.value)}>
          {usernames.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <label>Password</label>
        <input className="input" type="password" placeholder={mode === "claim" ? "Create password" : "Password"} value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn gold full" disabled={loading || password.length < 6}>{loading ? "Working…" : mode === "claim" ? "Create password" : "Sign in"}</button>
      </form>
      {message && <p className="login-message">{message}</p>}
      <div className="username-list"><strong>Usernames:</strong> kameron · mike · quentin</div>
    </section>
  </main>;
}
