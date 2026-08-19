"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type DogAdjustment = { id: string; title: string; body: string; created_at: string };
const PENDING_KEY = "pickem_pending_dog_adjustments_v1";
const PREFS_KEY = "pickem_ui_preferences_v2";

function myCardIsActive() {
  const panel = document.querySelector<HTMLElement>(".card-panel");
  if (!panel) return false;
  const active = panel.querySelector<HTMLElement>(".section-tabs button.active");
  return active?.textContent?.includes("My Card") ?? false;
}

function setMyCardSessionPreference() {
  try {
    const current = JSON.parse(window.sessionStorage.getItem(PREFS_KEY) || "{}") as any;
    window.sessionStorage.setItem(PREFS_KEY, JSON.stringify({
      ...current,
      mainTab: "My Card",
      sectionTabs: { ...(current.sectionTabs || {}), card: "My Card" }
    }));
  } catch {
    // The alert still works if storage is unavailable.
  }
}

function readStored(): DogAdjustment[] {
  try {
    return JSON.parse(window.sessionStorage.getItem(PENDING_KEY) || "[]") as DogAdjustment[];
  } catch {
    return [];
  }
}

export default function DogPickAdjustmentAlerts() {
  const [message, setMessage] = useState("");
  const resolving = useRef(false);
  const checked = useRef(false);

  useEffect(() => {
    let frame = 0;
    let active = true;

    async function resolve(adjustments: DogAdjustment[]) {
      if (!adjustments.length || resolving.current) return;
      resolving.current = true;
      const token = window.localStorage.getItem("pickem_session_token");
      if (!token) return;
      try {
        await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: "resolveDogAdjustments", ids: adjustments.map((item) => item.id) })
        });
      } catch {
        // A later visit can resolve the notification if this request fails.
      }
    }

    function show(adjustments: DogAdjustment[]) {
      if (!adjustments.length) return;
      const text = adjustments.length === 1
        ? adjustments[0].body
        : `${adjustments.length} dog picks changed: ${adjustments.map((item) => item.body).join(" • ")}`;
      setMessage(text);
      try { window.sessionStorage.removeItem(PENDING_KEY); } catch {}
      void resolve(adjustments);
    }

    async function check() {
      if (!active || !myCardIsActive()) return;
      const stored = readStored();
      if (stored.length) {
        show(stored);
        return;
      }
      if (checked.current) return;
      checked.current = true;
      const token = window.localStorage.getItem("pickem_session_token");
      if (!token) return;
      try {
        const response = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as { dogAdjustments?: DogAdjustment[] };
        const adjustments = payload.dogAdjustments || [];
        if (!adjustments.length) return;

        // The line move happened on the server. Refresh once before presenting the
        // alert so My Card cannot show a removed dog or an old win tier.
        try {
          window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(adjustments));
          Object.keys(window.sessionStorage).filter((key) => key.startsWith("pickem_app_data_v1:")).forEach((key) => window.sessionStorage.removeItem(key));
        } catch {}
        setMyCardSessionPreference();
        window.location.reload();
      } catch {
        checked.current = false;
      }
    }

    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => void check());
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
    const onFocus = () => { checked.current = false; void check(); };
    window.addEventListener("focus", onFocus);
    schedule();

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  if (!message) return null;
  return <div className="dog-adjustment-toast" role="alert" aria-live="assertive">
    <span><strong>Dog pick updated</strong>{message}</span>
    <button type="button" aria-label="Dismiss dog pick update" onClick={() => setMessage("")}><X size={16} /></button>
  </div>;
}
