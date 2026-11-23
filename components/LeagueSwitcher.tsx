"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Layers3, Star } from "lucide-react";
import { getClientSessionToken } from "@/lib/clientSession";
import { warmLeagueData } from "@/lib/leagueWarmup";
import type { LeagueMembership } from "@/lib/leagueAccess";
import type { PickemAppSlug } from "@/lib/authUsers";
import { preferredLeagueAmong, savePreferredLeague } from "@/lib/clientDefaultLeague";

type LeagueCache = { profileId: string; at: number; leagues: LeagueMembership[] };
const LEAGUE_CACHE_KEY = "pickem_leagues_session_v1";
const LEAGUE_CACHE_AGE = 30 * 60_000;

function profileId(): string {
  try {
    const profile = JSON.parse(window.localStorage.getItem("pickem_profile") || "null") as { id?: string } | null;
    return profile?.id || "";
  } catch { return ""; }
}

function readLeaguesCache(): LeagueMembership[] | null {
  if (typeof window === "undefined") return null;
  try {
    const entry = JSON.parse(window.sessionStorage.getItem(LEAGUE_CACHE_KEY) || "null") as LeagueCache | null;
    if (entry?.profileId && entry.profileId === profileId() && Date.now() - entry.at < LEAGUE_CACHE_AGE && Array.isArray(entry.leagues)) return entry.leagues;
  } catch { /* Fetching still works when storage is unavailable. */ }
  return null;
}

function saveLeaguesCache(leagues: LeagueMembership[]) {
  try {
    window.sessionStorage.setItem(LEAGUE_CACHE_KEY, JSON.stringify({ profileId: profileId(), at: Date.now(), leagues } satisfies LeagueCache));
  } catch { /* Caching is optional. */ }
}

export default function LeagueSwitcher({ activeSlug, selectedSlug, onSelect }: {
  activeSlug: PickemAppSlug;
  selectedSlug: PickemAppSlug;
  onSelect: (league: LeagueMembership) => void;
}) {
  const router = useRouter();
  const [leagues, setLeagues] = useState<LeagueMembership[] | null>(() => readLeaguesCache());
  const [defaultSlug, setDefaultSlug] = useState<PickemAppSlug | null>(null);
  const [savingDefault, setSavingDefault] = useState(false);
  const [defaultSaveError, setDefaultSaveError] = useState("");

  useEffect(() => {
    const list = leagues || [];
    if (!list.length) return;
    const fromProfile = preferredLeagueAmong(profileId(), list);
    setDefaultSlug(fromProfile || list[0].slug);
    if (fromProfile) savePreferredLeague(profileId(), fromProfile);
  }, [leagues]);

  useEffect(() => {
    const token = getClientSessionToken();
    if (!token) return;
    const controller = new AbortController();
    fetch("/api/my-leagues", { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = await response.json();
        if (!controller.signal.aborted && Array.isArray(payload.leagues)) {
          saveLeaguesCache(payload.leagues);
          const saved = payload.defaultLeague as PickemAppSlug | undefined;
          if (saved && payload.leagues.some((league: LeagueMembership) => league.slug === saved)) {
            savePreferredLeague(profileId(), saved);
            setDefaultSlug(saved);
          }
          setLeagues((previous) => JSON.stringify(previous) === JSON.stringify(payload.leagues) ? previous : payload.leagues);
          // Warm the existing header images before switching from Settings,
          // keeping the destination wordmark visible without a fade-in.
          for (const imagePath of ["/header-wordmark.png", "/football-pickem-wordmark.png", "/basketball-pickem-header-v2.png"]) {
            const previewImage = new window.Image();
            previewImage.src = imagePath;
            // Decode now rather than on the subsequent route's first paint.
            void previewImage.decode?.().catch(() => undefined);
          }
          for (const league of payload.leagues as LeagueMembership[]) {
            if (league.slug !== activeSlug) router.prefetch(league.homePath);
          }
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [activeSlug, router]);

  async function chooseDefault(league: LeagueMembership) {
    if (savingDefault || defaultSlug === league.slug) return;
    const token = getClientSessionToken();
    if (!token) return;
    const previousDefault = defaultSlug;
    setDefaultSlug(league.slug); // Immediate visual feedback, no network lag.
    setDefaultSaveError("");
    setSavingDefault(true);
    try {
      const response = await fetch("/api/default-league", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ slug: league.slug })
      });
      if (!response.ok) throw new Error("Could not save default league");
      savePreferredLeague(profileId(), league.slug);
      setDefaultSlug(league.slug);
    } catch {
      setDefaultSlug(previousDefault);
      setDefaultSaveError("Couldn’t save opening league. Try again.");
    } finally {
      setSavingDefault(false);
    }
  }

  function selectLeague(league: LeagueMembership) {
    onSelect(league);
    if (league.slug !== activeSlug) {
      router.prefetch(league.homePath);
      void warmLeagueData(league.slug);
    }
  }

  return <div className="settings-section settings-league-switcher">
    <h3>My Leagues</h3>
    <div className="settings-card">
      <div className="settings-row-heading"><div className="settings-leading-icon"><Layers3 size={17} /></div><div className="settings-row-copy"><strong>Switch League</strong><span>Tap to switch. Star to set your opening league.</span></div></div>
      {leagues?.map((league) => <div className="settings-league-preference-row" key={league.slug}>
        <button type="button" onClick={() => selectLeague(league)} aria-pressed={league.slug === selectedSlug} className={`settings-league-link ${league.slug === selectedSlug ? "active" : ""}`}>
          <span className={`settings-league-sport-mark ${league.sport.toLowerCase()}`} aria-hidden="true"><Image src={league.sport === "Basketball" ? "/league-basketball-orange.png" : "/league-football-brown.png"} alt="" width={22} height={22} unoptimized /></span><strong>{league.name}</strong>{league.slug === selectedSlug ? <><small>Selected</small><Check size={16} /></> : <ChevronRight size={17} />}
        </button>
        <button type="button" className={`settings-league-default ${defaultSlug === league.slug ? "active" : ""}`} disabled={savingDefault} aria-label={`Set ${league.name} as default opening league`} aria-pressed={defaultSlug === league.slug} title={defaultSlug === league.slug ? "Default opening league" : "Set as default"} onClick={() => chooseDefault(league)}><Star size={18} strokeWidth={2} fill={defaultSlug === league.slug ? "#D4A72C" : "none"} /></button>
      </div>)}
      {defaultSaveError && <p className="settings-league-loading" role="alert">{defaultSaveError}</p>}
      {!leagues && <div className="settings-league-loading">Loading leagues…</div>}
    </div>
  </div>;
}
