"use client";

import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setMessage("Add Supabase env vars first. Demo mode is available on the home page.");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    else window.location.href = "/";
  }

  return <main className="app-shell"><div className="container"><section className="card card-pad login-box">
    <h1 className="card-title">Sign in</h1>
    <p className="card-sub">Use the private accounts you create in Supabase for you, your dad, and your brother.</p>
    <form onSubmit={signIn}>
      <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button className="btn gold" style={{ width: "100%", marginTop: 12 }}>Sign in</button>
    </form>
    {message && <p className="small">{message}</p>}
  </section></div></main>;
}
