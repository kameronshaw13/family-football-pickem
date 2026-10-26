"use client";

import type { PlayerProfileStats } from "@/lib/playerProfileStats";
import { appSlugForPath } from "@/lib/appIdentity";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import MenuSelect from "@/components/MenuSelect";

type ProfilePayload = {
  details?: PlayerProfileStats;
  group: { slug: string; titleLabel: string };
  player: { id: string; displayName: string };
  period: { selected: string; label: string; availableYears: number[] };
  season: { wins: number; losses: number; pushes: number; winPct: number };
  legacy: { titles: number | null; titlesTracked: boolean };
  signature: {
    longestDog: { team: string; spread: number; opponent: string | null; bonusWins: number } | null;
    mostPickedTeam: string | null;
    mostPickedTeamRecord: { wins: number; losses: number; pushes: number } | null;
  };
  sideBets: { wins: number; losses: number; pushes: number; net: number; netText: string };
};

function record(wins: number, losses: number, pushes: number) {
  return `${wins}-${losses}-${pushes}`;
}

function profileMoney(value: number) {
  return `${value < 0 ? "−" : value > 0 ? "+" : ""}$${Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function percentage(value: number | null) {
  return value == null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function spread(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
}

function currentPickemSeason() {
  const now = new Date();
  const year = now.getFullYear();
  return String(now.getMonth() < 2 ? year - 1 : year);
}

export default function PlayerProfiles() {
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [activeName, setActiveName] = useState("");
  const [period, setPeriod] = useState(currentPickemSeason);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const profileCache = useRef(new Map<string, ProfilePayload>());
  const requestSequence = useRef(0);

  const profileRef = useRef(profile);
  profileRef.current = profile;
  const loadProfile = useCallback(async (name: string, nextPeriod: string, initial = false) => {
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token || !name) return;

    const requestId = ++requestSequence.current;
    const cacheKey = `${name}::${nextPeriod}`;
    const cached = profileCache.current.get(cacheKey);
    if (cached) {
      setProfile(cached);
      setPeriod(cached.period.selected);
    } else if (initial) {
      setProfile(null);
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/player-profile?name=${encodeURIComponent(name)}&year=${encodeURIComponent(nextPeriod)}`, {
        headers: { Authorization: `Bearer ${token}`, "x-pickem-group": appSlugForPath(window.location.pathname) || "shaw-family" },
        cache: "no-store"
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load player profile.");
      if (requestId !== requestSequence.current) return;
      const nextProfile = payload as ProfilePayload;
      profileCache.current.set(cacheKey, nextProfile);
      setProfile(nextProfile);
      setPeriod(nextProfile.period.selected);
    } catch (cause) {
      if (requestId !== requestSequence.current) return;
      setError(cause instanceof Error ? cause.message : "Could not load player profile.");
      if (profileRef.current) setPeriod(profileRef.current.period.selected);
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    function activate(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLElement>(".player-profile-link[data-player-profile-name]");
      const name = button?.dataset.playerProfileName || "";
      if (!name) return;
      const defaultPeriod = currentPickemSeason();
      setActiveName(name);
      setPeriod(defaultPeriod);
      void loadProfile(name, defaultPeriod, true);
    }

    function activateFromKeyboard(event: KeyboardEvent) {
      if (event.key !== "Enter" && event.key !== " ") return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLElement>(".player-profile-link[data-player-profile-name]");
      const name = button?.dataset.playerProfileName || "";
      if (!name) return;
      event.preventDefault();
      const defaultPeriod = currentPickemSeason();
      setActiveName(name);
      setPeriod(defaultPeriod);
      void loadProfile(name, defaultPeriod, true);
    }

    document.addEventListener("click", activate);
    document.addEventListener("keydown", activateFromKeyboard);
    return () => {
      document.removeEventListener("click", activate);
      document.removeEventListener("keydown", activateFromKeyboard);
    };
  }, [loadProfile]);

  useEffect(() => {
    if (!profile) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        requestSequence.current += 1;
        setProfile(null);
        setActiveName("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [profile]);

  const periodOptions = profile
    ? [{ value: "all", label: "All Time" }, ...profile.period.availableYears.map((year) => ({ value: String(year), label: String(year) }))]
    : [{ value: "all", label: "All Time" }];
  const seasonRecord = profile ? record(profile.season.wins, profile.season.losses, profile.season.pushes) : "";
  const sideBetRecord = profile ? record(profile.sideBets.wins, profile.sideBets.losses, profile.sideBets.pushes) : "";
  const titleCount = profile?.legacy.titlesTracked ? profile.legacy.titles ?? 0 : "—";
  const periodHeading = period === "all" ? "All-Time Pick'em" : `${period} Season`;
  const sideBetHeading = period === "all" ? "All-Time Side Bets" : `${period} Side Bets`;
  const favoriteRecord = profile?.signature.mostPickedTeamRecord
    ? record(profile.signature.mostPickedTeamRecord.wins, profile.signature.mostPickedTeamRecord.losses, profile.signature.mostPickedTeamRecord.pushes)
    : "";
  const biggestDog = profile?.signature.longestDog;
  const biggestDogText = biggestDog
    ? `${biggestDog.team} ${spread(biggestDog.spread)}${biggestDog.opponent ? ` vs ${biggestDog.opponent}` : ""} · +${biggestDog.bonusWins}${profile?.group.slug === "other-family" ? ` ${biggestDog.bonusWins === 1 ? "Pt" : "Pts"}` : "W"}`
    : "—";

  function closeProfile() {
    requestSequence.current += 1;
    setProfile(null);
    setActiveName("");
    setError("");
    setLoading(false);
  }

  return <>
    {error && <div className="profile-loading-toast profile-error-toast" role="alert">{error}</div>}
    {mounted && profile && activeName && createPortal(<div className="player-profile-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) closeProfile(); }}>
      <section className="player-profile-sheet" role="dialog" aria-modal="true" aria-labelledby="player-profile-title">
        <header className="player-profile-head">
          <div className="player-profile-head-copy"><span>Player Profile</span><h2 id="player-profile-title">{profile.player.displayName}</h2></div>
          <MenuSelect
            ariaLabel="Select profile year"
            className="compact-select profile-year-select"
            value={period}
            loading={loading}
            sections={[{ options: periodOptions }]}
            onChange={(value) => {
              setPeriod(value);
              void loadProfile(activeName, value);
            }}
          />
          <div className="pick-row-actions player-profile-close-wrap"><button type="button" className="icon-btn" aria-label="Close profile" onClick={closeProfile}><X size={16} /></button></div>
        </header>

        <div className="player-profile-content">
          <section className="player-profile-block player-profile-performance">
            <div className="player-profile-section-heading"><h3>{periodHeading}</h3></div>
            <div className="player-profile-performance-row">
              <div className="player-profile-record-mark"><span>Record</span><strong>{seasonRecord}</strong></div>
              <div className="player-profile-win-mark"><span>Win Rate</span><strong>{(profile.season.winPct * 100).toFixed(1)}%</strong></div>
            </div>
          </section>

          {profile.details && <section className="player-profile-block">
            <div className="player-profile-section-heading"><h3>Pick Breakdown</h3></div>
            {profile.details.leagues.length > 0 && <div className="player-profile-detail-grid">
              {profile.details.leagues.map(league => <div key={league.league}>
                <span>{league.league} Spread Picks</span>
                <strong>{record(league.wins, league.losses, league.pushes)}</strong>
                <small>{percentage(league.winPct)} win rate</small>
              </div>)}
            </div>}
            <div className="player-profile-detail-grid">
              <div><span>Dog Picks Won</span><strong>{profile.details.dogs.wins} / {profile.details.dogs.attempts}</strong><small>Completed dog picks</small></div>
              <div><span>Dog Bonus {profile.group.slug === "other-family" ? "Points" : "Wins"}</span><strong>+{profile.details.dogs.bonusWins}</strong><small>Earned from outright wins</small></div>
            </div>
          </section>}

          <section className="player-profile-block player-profile-highlights">
            <div className="player-profile-section-heading"><h3>Pick&apos;em Highlights</h3></div>
            <div className="player-profile-legacy-row">
              <div><span>Career Titles</span><small>{profile.group.titleLabel}</small></div>
              <strong>{titleCount}</strong>
            </div>
            <div className="player-profile-highlight-stack">
              <div>
                <span>Favorite Team</span>
                <strong>{profile.signature.mostPickedTeam || "—"}</strong>
                {profile.signature.mostPickedTeam && favoriteRecord && <small>{favoriteRecord} spread record</small>}
              </div>
              <div><span>Biggest Dog Won</span><strong>{biggestDogText}</strong></div>
            </div>
          </section>

          <section className="player-profile-block player-profile-side-bets">
            <div className="player-profile-section-heading"><h3>{sideBetHeading}</h3></div>
            <div className="player-profile-side-bet-metrics">
              <div><span>Record</span><strong>{sideBetRecord}</strong></div>
              <div><span>Net $</span><strong className={profile.sideBets.net > 0 ? "money-pos" : profile.sideBets.net < 0 ? "money-neg" : ""}>{profile.sideBets.netText}</strong></div>
            </div>
            {profile.details && <div className="player-profile-detail-grid">
              <div><span>Side Bet Win Rate</span><strong>{percentage(profile.details.sideBets.winPct)}</strong><small>Excludes pushes</small></div>
              <div><span>Settled Bets</span><strong>{profile.details.sideBets.settled}</strong><small>Includes pushes</small></div>
              <div><span>Biggest Win</span><strong className={profile.details.sideBets.biggestWin > 0 ? "money-pos" : ""}>{profileMoney(profile.details.sideBets.biggestWin)}</strong><small>Net profit on one bet</small></div>
              <div><span>Biggest Loss</span><strong className={profile.details.sideBets.biggestLoss < 0 ? "money-neg" : ""}>{profileMoney(profile.details.sideBets.biggestLoss)}</strong><small>Net loss on one bet</small></div>
            </div>}
          </section>
        </div>
      </section>
    </div>, document.body)}
  </>;
}
