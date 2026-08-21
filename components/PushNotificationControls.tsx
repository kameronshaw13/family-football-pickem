"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

type PushState = "checking" | "unsupported" | "needs-home-screen" | "not-configured" | "denied" | "disabled" | "enabled";

function authHeaders() {
  const token = window.localStorage.getItem("pickem_session_token");
  return token ? { Authorization: `Bearer ${token}` } : null;
}

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(Array.from(raw, (character) => character.charCodeAt(0)));
}

function isIosBrowser() {
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

export default function PushNotificationControls({ onCountsChanged }: { onCountsChanged?: (counts: Record<string, number>) => void }) {
  const [state, setState] = useState<PushState>("checking");
  const [publicKey, setPublicKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function inspect() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (isIosBrowser() && !isStandalone()) {
        if (!cancelled) setState("needs-home-screen");
        return;
      }
      const headers = authHeaders();
      if (!headers) return;
      try {
        const [registration, response] = await Promise.all([
          navigator.serviceWorker.register("/sw.js", { scope: "/" }),
          fetch("/api/notifications", { headers, cache: "no-store" })
        ]);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not check notifications.");
        if (cancelled) return;
        onCountsChanged?.(payload.counts || {});
        setPublicKey(payload.publicKey || "");
        if (!payload.configured) return setState("not-configured");
        if (Notification.permission === "denied") return setState("denied");
        const subscription = await registration.pushManager.getSubscription();
        setState(subscription ? "enabled" : "disabled");
      } catch (error) {
        if (!cancelled) {
          setState("disabled");
          setMessage(error instanceof Error ? error.message : "Could not check notifications.");
        }
      }
    }
    void inspect();
    return () => { cancelled = true; };
  }, [onCountsChanged]);

  async function post(body: object) {
    const headers = authHeaders();
    if (!headers) throw new Error("Sign in again to manage notifications.");
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Notification request failed.");
    onCountsChanged?.(payload.counts || {});
    return payload;
  }

  async function enable() {
    setBusy(true);
    setMessage("");
    try {
      if (!publicKey) throw new Error("Push keys have not been added to Vercel yet.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "disabled");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(publicKey)
      });
      await post({ action: "subscribe", subscription: subscription.toJSON(), userAgent: navigator.userAgent });
      setState("enabled");
      setMessage("Notifications enabled on this device.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not enable notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await post({ action: "unsubscribe", endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setState("disabled");
      setMessage("Notifications disabled on this device.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not disable notifications.");
    } finally {
      setBusy(false);
    }
  }

  const status = state === "enabled" ? "Enabled on this device"
    : state === "denied" ? "Blocked in iPhone Settings"
    : state === "needs-home-screen" ? "Add the app to your Home Screen first"
    : state === "not-configured" ? "Waiting for Vercel push keys"
    : state === "unsupported" ? "Not supported in this browser"
    : state === "checking" ? "Checking this device…"
    : "Off on this device";

  return <section className="notification-settings" aria-labelledby="notification-settings-title">
    <div className="notification-settings-copy">
      <div className="notification-settings-heading"><Bell size={17} /><strong id="notification-settings-title">Push Notifications</strong></div>
      <p>{status}</p>
      {message && <small role="status">{message}</small>}
    </div>
    <div className="notification-settings-actions">
      {state === "enabled"
        ? <button type="button" className="btn secondary" disabled={busy} onClick={() => void disable()}><BellOff size={14} /> Turn Off</button>
        : <button type="button" className="btn accent" disabled={busy || ["checking", "unsupported", "needs-home-screen", "not-configured", "denied"].includes(state)} onClick={() => void enable()}><Bell size={14} /> Enable</button>}
    </div>
  </section>;
}
