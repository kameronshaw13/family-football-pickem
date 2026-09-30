"use client";

import { useEffect, useState } from "react";
import MenuSelect from "@/components/MenuSelect";
import NumericText from "@/components/NumericText";
import { getClientSessionToken, storeClientSession } from "@/lib/clientSession";

const users = [
  { username: "kameron", label: "Kameron" },
  { username: "caleb", label: "Caleb" },
  { username: "mason", label: "Mason" },
  { username: "isaac", label: "Isaac" },
  { username: "josh", label: "Josh" },
  { username: "tate", label: "Tate" },
  { username: "jack", label: "Jack" },
  { username: "caden", label: "Caden" }
];

export default function DevelopmentLoginPage() {
  const [mode, setMode] = useState<"create" | "signin">("signin");
  const [username, setUsername] = useState(users[0].username);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const token = getClientSessionToken();
    if (token) {
      window.location.replace("/production-sim");
      return;
    }
    setSessionChecked(true);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(mode === "create" ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-pickem-group": "development" },
        body: JSON.stringify({ username, password, group: "development" })
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error || "Could not continue.");
        return;
      }
      storeClientSession(payload.token, payload.profile);
      window.location.replace("/production-sim");
    } catch {
      setMessage("Could not continue.");
    } finally {
      setLoading(false);
    }
  }

  if (!sessionChecked) return null;

  return <main className="app-shell login-screen login-friends">
    <section className="login-card">
      <div className="login-app-name">Development Pick&apos;em</div>
      <h1>{mode === "create" ? "Create your account" : "Sign in"}</h1>
      <p>{mode === "create" ? "Use a test player and create a password for this development app." : "Use the same player name and password you use in the other Pick'em apps."}</p>
      <div className="mode-toggle">
        <button type="button" className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setMessage(""); }}>Sign in</button>
        <button type="button" className={mode === "create" ? "active" : ""} onClick={() => { setMode("create"); setMessage(""); }}>Create account</button>
      </div>
      <form onSubmit={submit}>
        <label>Name</label>
        <MenuSelect ariaLabel="Name" className="input field-menu-select login-name-select" value={username} sections={[{ options: users.map((user) => ({ value: user.username, label: user.label })) }]} onChange={setUsername} />
        <label>Password</label>
        <input className="input" type="password" placeholder={mode === "create" ? "Create password" : "Password"} value={password} onChange={(event) => setPassword(event.target.value)} />
        <button className="btn gold full" disabled={loading || password.length < 6}>{loading ? "Working…" : mode === "create" ? "Create account" : "Sign in"}</button>
      </form>
      {message && <p className="login-message"><NumericText text={message} /></p>}
    </section>
  </main>;
}
