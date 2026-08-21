"use client";

import { useEffect, useState } from "react";
import MenuSelect from "@/components/MenuSelect";
import NumericText from "@/components/NumericText";

const users = [
  { username: "caleb", label: "Caleb" },
  { username: "monte", label: "Monte" },
  { username: "austin", label: "Austin" },
  { username: "clayton", label: "Clayton" }
];

export default function CalebFamilyLoginPage() {
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [username, setUsername] = useState(users[0].username);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = window.localStorage.getItem("pickem_session_token");
    if (token) window.location.replace("/caleb-family");
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(mode === "create" ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-pickem-group": "other-family" },
        body: JSON.stringify({ username, password, group: "other-family" })
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error || "Could not continue.");
        return;
      }
      window.localStorage.setItem("pickem_session_token", payload.token);
      window.localStorage.setItem("pickem_profile", JSON.stringify(payload.profile));
      window.location.replace("/caleb-family");
    } catch {
      setMessage("Could not continue.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="app-shell login-screen login-other-family">
    <section className="login-card">
      <div className="login-app-name">Caleb Family Pick&apos;em</div>
      <h1>{mode === "create" ? "Create your account" : "Sign in"}</h1>
      <p>{mode === "create" ? "Choose your name and create a private password. After this, use that password to get back in." : "Use your name and the password you created."}</p>
      <div className="mode-toggle">
        <button type="button" className={mode === "create" ? "active" : ""} onClick={() => { setMode("create"); setMessage(""); }}>Create account</button>
        <button type="button" className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setMessage(""); }}>Sign in</button>
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
