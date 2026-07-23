"use client";

import { useEffect, useState } from "react";

const users = [
  { username: "kameron", label: "Kameron" },
  { username: "mike", label: "Mike" },
  { username: "quentin", label: "Quentin" }
];

export default function LoginPage() {
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [username, setUsername] = useState("kameron");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = window.localStorage.getItem("pickem_session_token");
    if (token) window.location.href = "/";
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const response = await fetch(mode === "create" ? "/api/auth/register" : "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error || "Could not continue.");
      setLoading(false);
      return;
    }

    window.localStorage.setItem("pickem_session_token", payload.token);
    window.localStorage.setItem("pickem_profile", JSON.stringify(payload.profile));
    window.location.href = "/";
  }

  return <main className="app-shell login-screen">
    <section className="login-card">
      <div className="login-brand"><img className="login-logo" src="/header-wordmark.png" alt="Shaw Family Pick'em" width={800} height={96} /></div>
      <h1>{mode === "create" ? "Create your account" : "Sign in"}</h1>
      <p>{mode === "create" ? "Choose your name and create a private password. After this, use that password to get back in." : "Use your name and the password you created."}</p>

      <div className="mode-toggle">
        <button type="button" className={mode === "create" ? "active" : ""} onClick={() => { setMode("create"); setMessage(""); }}>Create account</button>
        <button type="button" className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setMessage(""); }}>Sign in</button>
      </div>

      <form onSubmit={submit}>
        <label>Name</label>
        <select className="input" value={username} onChange={(e) => setUsername(e.target.value)}>
          {users.map((u) => <option key={u.username} value={u.username}>{u.label}</option>)}
        </select>
        <label>Password</label>
        <input className="input" type="password" placeholder={mode === "create" ? "Create password" : "Password"} value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn gold full" disabled={loading || password.length < 6}>{loading ? "Working…" : mode === "create" ? "Create account" : "Sign in"}</button>
      </form>

      {message && <p className="login-message">{message}</p>}
      <div className="username-list"><strong>Names:</strong> Kameron · Mike · Quentin</div>
    </section>
  </main>;
}
