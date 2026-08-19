"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import MenuSelect from "@/components/MenuSelect";

type ProfilePayload = {
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
  const [activeName, setActiveName] = useState("");
  const [period, setPeriod] = useState(currentPickemSeason);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadProfile(name: string, nextPeriod: string, initial = false) {
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token || !name) return;
    if (initial) setProfile(null);
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/player-profile?name=${encodeURIComponent(name)}&year=${encodeURIComponent(nextPeriod)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load player profile.");
      setProfile(payload as ProfilePayload);
      setPeriod((payload as ProfilePayload).period.selected);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load player profile.");
      if (profile) setPeriod(profile.period.selected);
    } finally {
      setLoading(false);
    }
  }

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
  }, []);

  useEffect(() => {
    if (!profile) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
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
    ? `${biggestDog.team} ${spread(biggestDog.spread)}${biggestDog.opponent ? ` vs ${biggestDog.opponent}` : ""} · +${biggestDog.bonusWins}W`
    : "—";

  function closeProfile() {
    setProfile(null);
    setActiveName("");
    setError("");
  }

  return <>
    {error && <div className="profile-loading-toast profile-error-toast" role="alert">{error}</div>}
    {profile && <div className="player-profile-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) closeProfile(); }}>
      <section className="player-profile-sheet" role="dialog" aria-modal="true" aria-labelledby="player-profile-title">
        <header className="player-profile-head">
          <div className="player-profile-head-copy"><span>Player Profile</span><h2 id="player-profile-title">{profile.player.displayName}</h2></div>
          <MenuSelect
            ariaLabel="Select profile year"
            className="week-select-wrap header-menu-select profile-year-select"
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

          <section className="player-profile-block player-profile-highlights">
            <div className="player-profile-section-heading"><h3>Pick'em Highlights</h3></div>
            <div className="player-profile-legacy-row">
              <div><span>Career Titles</span><small>Shaw Pick'em</small></div>
              <strong>{titleCount}</strong>
            </div>
            <div className="player-profile-highlight-stack">
              <div>
                <span>Favorite Team Used</span>
                <strong>{profile.signature.mostPickedTeam || "—"}</strong>
                {profile.signature.mostPickedTeam && favoriteRecord && <small>{favoriteRecord} record</small>}
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
          </section>
        </div>
      </section>
    </div>}
  </>;
}
