"use client";

import { useEffect } from "react";
import type { AppSlug } from "@/lib/rulePresentation";

const CACHE_PREFIX = "pickem_app_data_v1";

type Target = {
  recipient_id?: string;
  response?: string;
  responded_at?: string | null;
};

type Bet = {
  id: string;
  status?: string;
  accepted_by?: string | null;
  updated_at?: string | null;
  targets?: Target[];
};

type CachedEntry = {
  payload?: { sideBets?: Bet[] };
};

function appSlugForPath(): AppSlug {
  const path = window.location.pathname;
  if (path === "/friends" || path.startsWith("/friends/")) return "friends";
  if (path === "/caleb-family" || path.startsWith("/caleb-family/")) return "other-family";
  return "shaw-family";
}

function signature(bets: Bet[] = []) {
  return bets
    .map((bet) => ({
      id: bet.id,
      status: bet.status || "",
      acceptedBy: bet.accepted_by || "",
      updatedAt: bet.updated_at || "",
      targets: (bet.targets || [])
        .map((target) => `${target.recipient_id || ""}:${target.response || ""}:${target.responded_at || ""}`)
        .sort()
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((bet) => `${bet.id}|${bet.status}|${bet.acceptedBy}|${bet.updatedAt}|${bet.targets.join(",")}`)
    .join(";");
}

function cachedSideBetSignature(appSlug: AppSlug) {
  const prefix = `${CACHE_PREFIX}:${appSlug}:`;
  let newest: { cachedAt: number; bets: Bet[] } | null = null;
  try {
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const entry = JSON.parse(window.sessionStorage.getItem(key) || "null") as (CachedEntry & { cachedAt?: number }) | null;
      if (!entry?.payload?.sideBets) continue;
      const cachedAt = Number(entry.cachedAt || 0);
      if (!newest || cachedAt > newest.cachedAt) newest = { cachedAt, bets: entry.payload.sideBets };
    }
  } catch {
    return null;
  }
  return newest ? signature(newest.bets) : null;
}

function clearAppCache(appSlug: AppSlug) {
  const prefix = `${CACHE_PREFIX}:${appSlug}:`;
  try {
    const keys: string[] = [];
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    keys.forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // A normal network load still refreshes the app if storage is unavailable.
  }
}

function reloadDestination() {
  const url = new URL(window.location.href);
  if (document.querySelector(".side-bet-card.mode-sent")) url.searchParams.set("notification", "side_bets_sent");
  else if (document.querySelector(".side-bet-card.mode-received")) url.searchParams.set("notification", "side_bets_received");
  return url.toString();
}

export default function SideBetAutoSync() {
  useEffect(() => {
    const appSlug = appSlugForPath();
    let baseline = cachedSideBetSignature(appSlug);
    let stopped = false;
    let checking = false;

    async function check() {
      if (stopped || checking || document.visibilityState !== "visible") return;
      if (!document.querySelector(".side-bet-center")) return;
      const token = window.localStorage.getItem("pickem_session_token");
      if (!token) return;
      checking = true;
      try {
        const response = await fetch("/api/app-data", {
          headers: { Authorization: `Bearer ${token}`, "x-pickem-group": appSlug },
          cache: "no-store"
        });
        if (!response.ok) return;
        const payload = await response.json() as { sideBets?: Bet[] };
        const next = signature(payload.sideBets || []);
        if (baseline == null) {
          baseline = next;
          return;
        }
        if (next !== baseline) {
          clearAppCache(appSlug);
          window.location.replace(reloadDestination());
        }
      } catch {
        // Keep the current UI and retry on the next foreground check.
      } finally {
        checking = false;
      }
    }

    void check();
    const timer = window.setInterval(() => void check(), 2500);
    const foregroundCheck = () => void check();
    window.addEventListener("focus", foregroundCheck);
    document.addEventListener("visibilitychange", foregroundCheck);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", foregroundCheck);
      document.removeEventListener("visibilitychange", foregroundCheck);
    };
  }, []);

  return null;
}
