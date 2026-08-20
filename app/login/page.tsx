"use client";

import { useEffect, useMemo, useState } from "react";
import MenuSelect from "@/components/MenuSelect";
import NumericText from "@/components/NumericText";

type AppSlug = "shaw-family" | "other-family" | "friends";
type AppConfig = { name: string; home: string; users: Array<{ username: string; label: string }>; shaw?: boolean; passwordless?: boolean; icon?: string };

const appConfig: Record<AppSlug, AppConfig> = {
  "shaw-family": {
    name: "Shaw Family Pick'em",
    home: "/",
    shaw: true,
    users: [
      { username: "kameron", label: "Kameron" },
      { username: "mike", label: "Mike" },
      { username: "quentin", label: "Quentin" }
    ]
  },
  "other-family": {
    name: "Caleb Family Pick'em",
    home: "/other-family",
    passwordless: true,
    icon: "/caleb-family-icon.png",
    users: [
      { username: "caleb", label: "Caleb" },
      { username: "monte", label: "Monte" },
      { username: "austin", label: "Austin" },
      { username: "clayton", label: "Clayton" }
    ]
  },
  friends: {
    name: "Friends Pick'em",
    home: "/friends",
    icon: "/friends-app-icon.png",
    users: [
      { username: "kameron", label: "Kameron" },
      { username: "caleb", label: "Caleb" },
      { username: "mason", label: "Mason" },
      { username: "isaac", label: "Isaac" },
      { username: "josh", label: "Josh" }
    ]
  }
};

function groupFromCookie(): AppSlug {
  const match = document.cookie.split(";").map((value) => value.trim()).find((value) => value.startsWith("pickem_group="));
  const value = match ? decodeURIComponent(match.split("=").slice(1).join("=")) : "shaw-family";
  return value === "friends" || value === "other-family" ? value : "shaw-family";
}

export default function LoginPage() {
  const [groupSlug, setGroupSlug] = useState<AppSlug | null>(null);
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const group = groupFromCookie();
    setGroupSlug(group);
    setUsername(appConfig[group].users[0].username);
    const token = window.localStorage.getItem("pickem_session_token");
    if (group === "other-family") {
      // Caleb Family is intentionally passwordless for setup/testing right now.
      window.localStorage.removeItem("pickem_session_token");
      window.localStorage.removeItem("pickem_profile");
      return;
    }
    if (token) window.location.replace(appConfig[group].home);
  }, []);

  const config = useMemo(() => groupSlug ? appConfig[groupSlug] : null, [groupSlug]);
  if (!config || !groupSlug) return <main className="app-shell login-screen"><section className="login-card"><div className="login-brand login-brand-generic"><strong>Football Pick'em</strong></div><p>Loading…</p></section></main>;
  const homePath = config.home;
  const passwordless = Boolean(config.passwordless);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const action = passwordless ? "/api/auth/login" : mode === "create" ? "/api/auth/register" : "/api/auth/login";
    const response = await fetch(action, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: passwordless ? undefined : password, group: groupSlug })
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error || "Could not continue.");
      setLoading(false);
      return;
    }
    window.localStorage.setItem("pickem_session_token", payload.token);
    window.localStorage.setItem("pickem_profile", JSON.stringify(payload.profile));
    window.location.replace(homePath);
  }

  return <main className={`app-shell login-screen login-${groupSlug}`}>
    <section className="login-card">
      {config.shaw
        ? <div className="login-brand"><img className="login-brand-wordmark" src="/header-wordmark.png" alt="Shaw Family Pick'em" /></div>
        : <div className="login-brand login-brand-generic">{config.icon && <img className="login-brand-app-icon" src={config.icon} alt="" />}<strong>{config.name}</strong></div>}
      <h1>{passwordless ? "Enter Caleb Family" : mode === "create" ? "Create your account" : "Sign in"}</h1>
      <p>{passwordless ? "Choose a name to open the app. Passwords are temporarily disabled while the league is being set up." : mode === "create" ? "Choose your name and create a private password. After this, use that password to get back in." : "Use your name and the password you created."}</p>
      {!passwordless && <div className="mode-toggle">
        <button type="button" className={mode === "create" ? "active" : ""} onClick={() => { setMode("create"); setMessage(""); }}>Create account</button>
        <button type="button" className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setMessage(""); }}>Sign in</button>
      </div>}
      <form onSubmit={submit}>
        <label>Name</label>
        <MenuSelect ariaLabel="Name" className="input field-menu-select login-name-select" value={username} sections={[{ options: config.users.map((user) => ({ value: user.username, label: user.label })) }]} onChange={setUsername} />
        {!passwordless && <>
          <label>Password</label>
          <input className="input" type="password" placeholder={mode === "create" ? "Create password" : "Password"} value={password} onChange={(e) => setPassword(e.target.value)} />
        </>}
        <button className="btn gold full" disabled={loading || (!passwordless && password.length < 6)}>{loading ? "Working…" : passwordless ? "Enter app" : mode === "create" ? "Create account" : "Sign in"}</button>
      </form>
      {message && <p className="login-message"><NumericText text={message} /></p>}
    </section>
  </main>;
}
