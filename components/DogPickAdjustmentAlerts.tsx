"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

type DogAdjustment = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

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
    const current = JSON.parse(window.sessionStorage.getItem(PREFS_KEY) || "{}") as {
      mainTab?: string;
      sectionTabs?: Record<string, string>;
    };
    window.sessionStorage.setItem(PREFS_KEY, JSON.stringify({
      ...current,
      mainTab: "My Card",
      sectionTabs: { ...(current.sectionTabs || {}), card: "My Card" }
    }));
  } catch {
    // Alert still works without session storage.
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
    let active = true;
    const timers: number[] = [];

    async function resolve(adjustments: DogAdjustment[]) {
      if (!adjustments.length || resolving.current) return;
      resolving.current = true;
      const token = window.localStorage.getItem("pickem_session_token");
      if (!token) {
        resolving.current = false;
        return;
      }
      try {
        await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: "resolveDogAdjustments", ids: adjustments.map((item) => item.id) })
        });
      } catch {
        // A later visit can resolve it.
      } finally {
        resolving.current = false;
      }
    }

    function show(adjustments: DogAdjustment[]) {
      if (!adjustments.length) return;
      setMessage(adjustments.length === 1
        ? adjustments[0].body
        : `${adjustments.length} dog picks changed: ${adjustments.map((item) => item.body).join(" • ")}`);
      try {
        window.sessionStorage.removeItem(PENDING_KEY);
      } catch {
        // Non-critical.
      }
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
        const response = await fetch("/api/notifications", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store"
        });
        if (!response.ok) return;
        const payload = await response.json() as { dogAdjustments?: DogAdjustment[] };
        const adjustments = payload.dogAdjustments || [];
        if (!adjustments.length) return;
        try {
          window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(adjustments));
          for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
            const key = window.sessionStorage.key(index);
            if (key?.startsWith("pickem_app_data_v1:")) window.sessionStorage.removeItem(key);
          }
        } catch {
          // Reload will still fetch current data even if storage cleanup fails.
        }
        setMyCardSessionPreference();
        window.location.reload();
      } catch {
        checked.current = false;
      }
    }

    function schedule(delay = 0) {
      timers.push(window.setTimeout(() => void check(), delay));
    }

    function onClick(event: MouseEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest(".primary-nav button, .section-tabs button")) schedule(0);
    }

    const onFocus = () => {
      checked.current = false;
      void check();
    };

    [0, 250, 800, 1600].forEach(schedule);
    document.addEventListener("click", onClick, true);
    window.addEventListener("focus", onFocus);

    return () => {
      active = false;
      timers.forEach((timer) => window.clearTimeout(timer));
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  if (!message) return null;

  return <div className="dog-adjustment-toast" role="alert" aria-live="assertive">
    <span><strong>Dog pick updated</strong>{message}</span>
    <button type="button" aria-label="Dismiss dog pick update" onClick={() => setMessage("")}><X size={16} /></button>
  </div>;
}
