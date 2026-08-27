"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, LoaderCircle } from "lucide-react";
import type { AppSlug } from "@/lib/rulePresentation";
import { appWorkerScope } from "@/lib/appIdentity";

type PushState = "checking" | "unsupported" | "needs-home-screen" | "not-configured" | "denied" | "disabled" | "enabled";

const pushStateCache = new Map<AppSlug, Exclude<PushState, "checking">>();

function activeAppSlug(explicit?: AppSlug): AppSlug {
  if (explicit) return explicit;
  if (typeof window === "undefined") return "shaw-family";
  if (window.location.pathname === "/friends" || window.location.pathname.startsWith("/friends/")) return "friends";
  if (window.location.pathname === "/caleb-family" || window.location.pathname.startsWith("/caleb-family/")) return "other-family";
  return "shaw-family";
}

function authHeaders(appSlug: AppSlug) {
  const token = window.localStorage.getItem("pickem_session_token");
  return token ? { Authorization: `Bearer ${token}`, "x-pickem-group": appSlug } : null;
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

async function appRegistration(appSlug: AppSlug) {
  const wanted = appWorkerScope(appSlug);
  const wantedPath = wanted === "/" ? "/" : wanted.replace(/\/$/, "");
  const registrations = await navigator.serviceWorker.getRegistrations();

  for (const registration of registrations) {
    const scopePath = new URL(registration.scope).pathname.replace(/\/$/, "") || "/";
    if (appSlug !== "shaw-family" && scopePath === "/") await registration.unregister();
    if (!["/", "/friends", "/caleb-family"].includes(scopePath)) await registration.unregister();
  }

  let registration = await navigator.serviceWorker.getRegistration(wanted);
  const existingPath = registration ? new URL(registration.scope).pathname.replace(/\/$/, "") || "/" : "";
  if (!registration || existingPath !== wantedPath) registration = await navigator.serviceWorker.register("/sw.js", { scope: wanted });
  if (registration.active) return registration;

  await new Promise<void>((resolve) => {
    const worker = registration.installing || registration.waiting;
    if (!worker) return resolve();
    const done = () => { if (worker.state === "activated") resolve(); };
    worker.addEventListener("statechange", done);
    done();
    window.setTimeout(resolve, 2500);
  });
  return registration;
}

export default function PushNotificationControls({ appSlug: explicitAppSlug, onCountsChanged }: { appSlug?: AppSlug; onCountsChanged?: (counts: Record<string, number>) => void }) {
  const appSlug = activeAppSlug(explicitAppSlug);
  const [state, setState] = useState<PushState>(() => pushStateCache.get(appSlug) || "checking");
  const [publicKey, setPublicKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function rememberState(next: Exclude<PushState, "checking">) {
    pushStateCache.set(appSlug, next);
    setState(next);
  }

  async function post(body: object) {
    const headers = authHeaders(appSlug);
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

  useEffect(() => {
    let cancelled = false;
    async function inspect() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (!cancelled) rememberState("unsupported");
        return;
      }
      if (isIosBrowser() && !isStandalone()) {
        if (!cancelled) rememberState("needs-home-screen");
        return;
      }
      const headers = authHeaders(appSlug);
      if (!headers) return;
      try {
        const registration = await appRegistration(appSlug);
        const response = await fetch("/api/notifications", { headers, cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not check notifications.");
        if (cancelled) return;
        onCountsChanged?.(payload.counts || {});
        setPublicKey(payload.publicKey || "");
        if (!payload.configured) return rememberState("not-configured");
        if (Notification.permission === "denied") return rememberState("denied");

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription && Notification.permission === "granted" && payload.publicKey) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey(payload.publicKey)
          });
        }
        if (subscription) {
          await post({ action: "subscribe", subscription: subscription.toJSON(), userAgent: navigator.userAgent });
          if (!cancelled) rememberState("enabled");
        } else if (!cancelled) {
          rememberState("disabled");
        }
      } catch (error) {
        if (!cancelled) {
          rememberState("disabled");
          setMessage(error instanceof Error ? error.message : "Could not check notifications.");
        }
      }
    }
    void inspect();
    return () => { cancelled = true; };
  // post and rememberState intentionally use the same appSlug and callback for this mounted control.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appSlug, onCountsChanged]);

  async function enable() {
    setBusy(true);
    setMessage("");
    try {
      if (!publicKey) throw new Error("Push keys have not been added to Vercel yet.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        rememberState(permission === "denied" ? "denied" : "disabled");
        return;
      }
      const registration = await appRegistration(appSlug);
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(publicKey)
      });
      await post({ action: "subscribe", subscription: subscription.toJSON(), userAgent: navigator.userAgent });
      rememberState("enabled");
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
      const registration = await appRegistration(appSlug);
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await post({ action: "unsubscribe", endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      rememberState("disabled");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not disable notifications.");
    } finally {
      setBusy(false);
    }
  }

  const helper = state === "denied" ? "Blocked in iPhone Settings"
    : state === "needs-home-screen" ? "Add the app to your Home Screen first"
    : state === "not-configured" ? "Waiting for Vercel push keys"
    : state === "unsupported" ? "Not supported in this browser"
    : "";
  const unavailable = ["unsupported", "needs-home-screen", "not-configured", "denied"].includes(state);

  return <section className="notification-settings" aria-labelledby="notification-settings-title">
    <div className="notification-settings-copy">
      <div className="notification-settings-heading"><Bell size={17} /><strong id="notification-settings-title">Push Notifications</strong></div>
      {helper && <p>{helper}</p>}
      {message && <small role="status">{message}</small>}
    </div>
    <div className="notification-settings-actions">
      {state === "checking"
        ? <button type="button" className="btn secondary notification-compact-toggle notification-status-check" disabled aria-label="Checking notification status"><span className="notification-status-spinner" aria-hidden="true"><LoaderCircle size={12} /></span><span>Notifications</span></button>
        : state === "enabled"
        ? <button type="button" className="btn secondary notification-compact-toggle enabled" disabled={busy} aria-label="Turn off push notifications" onClick={() => void disable()}>{busy ? <span className="notification-status-spinner" aria-hidden="true"><LoaderCircle size={12} /></span> : <Bell size={13} />}<span>Notifications</span><span className="notification-compact-state">On</span></button>
        : <button type="button" className="btn secondary notification-compact-toggle disabled" disabled={busy || unavailable} aria-label={helper || "Turn on push notifications"} title={helper || message || undefined} onClick={() => void enable()}>{busy ? <span className="notification-status-spinner" aria-hidden="true"><LoaderCircle size={12} /></span> : <BellOff size={13} />}<span>Notifications</span><span className="notification-compact-state">Off</span></button>}
    </div>
  </section>;
}
