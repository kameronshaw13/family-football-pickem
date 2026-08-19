"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

type Group = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  currentSeasonYear: number;
  timezone: string;
  isDefault: boolean;
  branding: Record<string, unknown>;
  role: "owner" | "admin" | "member";
};

type GroupsPayload = { ok: boolean; groups: Group[]; activeGroup: Group; error?: string };

const APP_DATA_CACHE_PREFIX = "pickem_app_data_v1:";

function brandingString(group: Group | null, key: string, fallback = "") {
  const value = group?.branding?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clearGroupCaches() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (key?.startsWith(APP_DATA_CACHE_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // Group switching still works if browser storage is unavailable.
  }
}

export default function GroupExperience() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [active, setActive] = useState<Group | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const existing = document.querySelector<HTMLElement>(".brand-lockup");
    if (existing) {
      setHost(existing);
      return;
    }
    const observer = new MutationObserver(() => {
      const next = document.querySelector<HTMLElement>(".brand-lockup");
      if (!next) return;
      setHost(next);
      observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) return;
    let cancelled = false;

    async function loadGroups() {
      try {
        const requested = new URL(window.location.href).searchParams.get("group");
        if (requested) {
          const switchResponse = await fetch("/api/groups", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ group: requested }),
            cache: "no-store"
          });
          if (switchResponse.ok) {
            clearGroupCaches();
            const url = new URL(window.location.href);
            url.searchParams.delete("group");
            window.location.replace(`${url.pathname}${url.search}${url.hash}`);
            return;
          }
        }

        const response = await fetch("/api/groups", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as GroupsPayload;
        if (cancelled || !payload.ok) return;
        setGroups(payload.groups || []);
        setActive(payload.activeGroup || null);
      } catch {
        // The core app remains usable if the optional group menu cannot load.
      }
    }

    void loadGroups();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const theme = brandingString(active, "theme", "default");
    if (active) {
      document.documentElement.dataset.pickemGroup = active.slug;
      document.documentElement.dataset.pickemTheme = theme;
      document.body.classList.add("group-brand-mounted");
    }
    return () => {
      document.body.classList.remove("group-brand-mounted");
    };
  }, [active]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  async function switchGroup(group: Group) {
    if (!active || group.id === active.id || switching) {
      setOpen(false);
      return;
    }
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) return;
    setSwitching(true);
    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ group: group.slug }),
        cache: "no-store"
      });
      if (!response.ok) return;
      clearGroupCaches();
      window.location.reload();
    } finally {
      setSwitching(false);
    }
  }

  if (!host || !active) return null;
  const shaw = active.slug === "shaw-family";
  const label = brandingString(active, "headerLabel", active.shortName || active.name);

  return createPortal(
    <div className={`group-brand ${shaw ? "group-brand-shaw" : "group-brand-football"}`} ref={menuRef}>
      <button type="button" className="group-brand-trigger" aria-haspopup={groups.length > 1 ? "menu" : undefined} aria-expanded={groups.length > 1 ? open : undefined} onClick={() => groups.length > 1 && setOpen((value) => !value)} disabled={switching}>
        {shaw
          ? <img className="group-brand-wordmark" src="/header-wordmark.png" alt="Shaw Family Pick'em" width={800} height={96} decoding="async" />
          : <><span className="group-brand-football-icon" aria-hidden="true">🏈</span><span className="group-brand-label">{label}</span></>}
        {groups.length > 1 && <ChevronDown className="group-brand-chevron" size={15} />}
      </button>
      {open && groups.length > 1 && <div className="group-brand-menu" role="menu" aria-label="Choose Pick'em group">
        {groups.map((group) => <button key={group.id} type="button" role="menuitem" className={group.id === active.id ? "active" : ""} onClick={() => void switchGroup(group)}>
          <span>{group.shortName || group.name}</span>{group.id === active.id && <Check size={15} />}
        </button>)}
      </div>}
    </div>,
    host
  );
}
