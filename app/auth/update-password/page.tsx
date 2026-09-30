"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getUniversalSupabase } from "@/lib/universalAuthClient";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  async function submit() {
    if (password.length < 8) { setMessage("Use at least 8 characters."); return; }
    if (password !== confirm) { setMessage("Passwords do not match."); return; }
    setWorking(true);
    const { error } = await getUniversalSupabase().auth.updateUser({ password });
    setWorking(false);
    if (error) { setMessage(error.message); return; }
    setMessage("Password updated.");
    window.setTimeout(() => router.replace("/"), 700);
  }

  return <main className="universal-auth-page">
    <section className="universal-auth-card">
      <span className="universal-eyebrow">ACCOUNT RECOVERY</span>
      <h1>Choose a new password.</h1>
      <p>Use a password you do not use on another service.</p>
      <label><span>New password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <label><span>Confirm password</span><input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label>
      {message && <div className="universal-form-message">{message}</div>}
      <button type="button" className="universal-primary-button" disabled={working} onClick={submit}>{working ? "Updating…" : "Update Password"}</button>
    </section>
  </main>;
}
