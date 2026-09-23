"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { LoaderCircle, X } from "lucide-react";
import type { Game } from "@/lib/types";
import { normalizeSpreadForSelectedTeam, spreadText } from "@/lib/spreads";
import { teamDisplayName } from "@/lib/teamNames";

type PreviewTab = "overview" | "advanced" | "recent" | "ats" | "history";

type RecentGame = {
  id: number;
  week: number;
  date: string;
  opponent: string;
  home: boolean;
  teamPoints: number;
  opponentPoints: number;
  margin: number;
  result: "W" | "L" | "T";
};

type AtsGame = {
  id: number;
  week: number;
  date: string;
  opponent: string;
  home: boolean;
  spread: number;
  teamPoints: number;
  opponentPoints: number;
  coverMargin: number;
  result: "W" | "L" | "P";
};

type TeamPreview = {
  name: string;
  record: { wins: number; losses: number };
  scoring: { ppg: number | null; allowedPpg: number | null; margin: number | null };
  regular: {
    yardsPerGame: number | null;
    passYardsPerGame: number | null;
    rushYardsPerGame: number | null;
    turnoversPerGame: number | null;
    thirdDownPct: number | null;
  };
  ats: {
    wins: number;
    losses: number;
    pushes: number;
    avgCoverMargin: number | null;
    recent: AtsGame[];
  };
  advanced: {
    source?: string;
    throughWeek?: number | null;
    offense?: {
      epaPerPlay?: number | null;
      ppaPerPlay?: number | null;
      successRate?: number | null;
      passEpaPerPlay?: number | null;
      rushEpaPerPlay?: number | null;
      passSuccessRate?: number | null;
      rushSuccessRate?: number | null;
      explosiveRate?: number | null;
      yardsPerPlay?: number | null;
      lineYardsPerCarry?: number | null;
      powerSuccessRate?: number | null;
      stuffRate?: number | null;
      earlyDownEpaPerPlay?: number | null;
      lateDownEpaPerPlay?: number | null;
      thirdDownSuccessRate?: number | null;
      redZoneSuccessRate?: number | null;
      pointsPerOpportunity?: number | null;
    };
    defense?: {
      havocRate?: number | null;
      passHavocRate?: number | null;
      rushHavocRate?: number | null;
      frontSevenHavocRate?: number | null;
      dbHavocRate?: number | null;
      sackRate?: number | null;
      tflRate?: number | null;
      driveStoppedRate?: number | null;
      stuffRate?: number | null;
    };
    ranks?: {
      offense?: Record<string, number | null>;
      defense?: Record<string, number | null>;
    };
  } | null;
  relative: {
    source: string;
    throughWeek: number | null;
    validGames: number | null;
    enoughSample: boolean;
    overallValue: number | null;
    overallRank: number | null;
    offense: {
      adjustedEpa: number | null;
      adjustedEpaRank: number | null;
      epaPerPlay: number | null;
      epaPerPlayRank: number | null;
      successRate: number | null;
      successRateRank: number | null;
      explosivePlayRate: number | null;
      explosivePlayRank: number | null;
      yardsPerPlay: number | null;
      yardsPerPlayRank: number | null;
      lineYards: number | null;
      lineYardsRank: number | null;
      thirdDownRate: number | null;
      thirdDownRank: number | null;
      redZoneRate: number | null;
      redZoneRank: number | null;
    };
    defense: {
      adjustedEpa: number | null;
      adjustedEpaRank: number | null;
      epaPerPlay: number | null;
      epaPerPlayRank: number | null;
      successRate: number | null;
      successRateRank: number | null;
      explosivePlayRate: number | null;
      explosivePlayRank: number | null;
      yardsPerPlay: number | null;
      yardsPerPlayRank: number | null;
      lineYards: number | null;
      lineYardsRank: number | null;
      thirdDownRate: number | null;
      thirdDownRank: number | null;
      redZoneRate: number | null;
      redZoneRank: number | null;
    };
  } | null;

  power: {
    source?: string;
    throughWeek?: number | null;
    fpi?: number | null;
    fpiRank?: number | null;
    offenseEfficiency?: number | null;
    offenseEfficiencyRank?: number | null;
    defenseEfficiency?: number | null;
    defenseEfficiencyRank?: number | null;
    specialTeamsEfficiency?: number | null;
    specialTeamsEfficiencyRank?: number | null;
    adjustedOffEpa?: number | null;
    adjustedDefEpa?: number | null;
    adjustedNetEpa?: number | null;
    adjustedOffRank?: number | null;
    adjustedDefRank?: number | null;
    adjustedNetRank?: number | null;
  } | null;
  sp: {
    rating: number | null;
    ranking: number | null;
    offense?: { rating?: number | null; ranking?: number | null };
    defense?: { rating?: number | null; ranking?: number | null };
    specialTeams?: { rating?: number | null };
  } | null;
  recent: RecentGame[];
};

type PreviewPayload = {
  season: number;
  throughWeek: number;
  teams: { away: TeamPreview; home: TeamPreview };
  headToHead: {
    team1: string;
    team2: string;
    team1Wins: number;
    team2Wins: number;
    ties: number;
    games: Array<{
      season: number;
      week: number;
      date: string;
      neutralSite: boolean;
      venue: string | null;
      homeTeam: string;
      homeScore: number;
      awayTeam: string;
      awayScore: number;
      winner: string | null;
    }>;
  } | null;
  availability: {
    games: boolean;
    lines: boolean;
    regularStats: boolean;
    advanced: boolean;
    sp: boolean;
    history: boolean;
    baseSource?: string;
    advancedSource?: string | null;
  };
};

function fmt(value: number | null | undefined, digits = 1) {
  return value == null || !Number.isFinite(value) ? "—" : value.toFixed(digits);
}

function fmtPct(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(1)}%`;
}

function fmtSigned(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "—";
  const fixed = value.toFixed(digits);
  return value > 0 ? `+${fixed}` : fixed;
}

function teamLogo(game: Game, side: "away" | "home") {
  return side === "away" ? game.away_logo_url : game.home_logo_url;
}

function espnTeamIdFromLogo(url: string | null | undefined) {
  if (!url) return null;
  return url.match(/\/(\d+)\.(?:png|svg|webp)(?:\?|$)/i)?.[1] || null;
}

const ADVANCED_METRIC_INFO: Record<string, string> = {
  "Overall Adjusted EPA": "National rank of opponent-adjusted net EPA. It combines adjusted offensive and defensive efficiency; #1 is best.",
  "Adjusted EPA / Play": "Opponent-adjusted EPA per play for the unit shown. It accounts for the quality of opponents; #1 is best.",
  "Success Rate": "How often a unit wins the down based on down and distance. These are national FBS ranks; #1 is best.",
  "Explosive Play Rate": "How often a unit creates or prevents high-value explosive plays. These are national FBS ranks; #1 is best.",
  "Yards / Play": "National rank in yards gained or allowed per play, depending on the unit shown; #1 is best.",
  "Line Yards / Carry": "A line-play rushing metric estimating yards created or prevented near the line of scrimmage. These are national FBS ranks; #1 is best.",
  "3rd Down Success Rate": "National rank in third-down success for the offense or prevention for the defense; #1 is best.",
  "FPI": "ESPN Football Power Index national rank. It is an opponent-adjusted team-strength rating; #1 is best."
};


function MetricInfo({ label, text }: { label: string; text: string }) {
  return <details className="matchup-metric-info">
    <summary aria-label={`Explain ${label}`}><span aria-hidden="true">i</span></summary>
    <span className="matchup-metric-info-popover"><strong>{label}</strong>{text}</span>
  </details>;
}

function rankText(value: number | null | undefined) {
  return value != null && Number.isFinite(value) ? `#${Math.round(Number(value))}` : "—";
}

function valueRank(value: number | null | undefined, rank: number | null | undefined, formatter: (value: number) => string) {
  if (value == null || !Number.isFinite(value)) return "—";
  const formatted = formatter(Number(value));
  return rank != null && Number.isFinite(rank) ? `${formatted} · #${Math.round(Number(rank))}` : formatted;
}

const signed3 = (value: number) => value > 0 ? `+${value.toFixed(3)}` : value.toFixed(3);
const signed2 = (value: number) => value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
const percent1 = (value: number) => `${(Math.abs(value) <= 1 ? value * 100 : value).toFixed(1)}%`;
const number2 = (value: number) => value.toFixed(2);

function MetricRow({ label, away, home, explain = true }: { label: string; away: string; home: string; explain?: boolean }) {
  const info = explain ? ADVANCED_METRIC_INFO[label] : undefined;
  return <div className="matchup-metric-row">
    <strong>{away}</strong>
    <span className="matchup-metric-label"><span>{label}</span>{info ? <MetricInfo label={label} text={info} /> : null}</span>
    <strong>{home}</strong>
  </div>;
}

function TeamColumnLabel({ game, side, name }: { game: Game; side: "away" | "home"; name: string }) {
  const logo = teamLogo(game, side);
  return <div className="matchup-team-column-label">
    {logo ? <img src={logo} alt="" width={32} height={32} /> : <span className="matchup-logo-fallback" />}
    <strong>{name}</strong>
  </div>;
}

function TeamSectionTitle({ game, side, name, detail }: { game: Game; side: "away" | "home"; name: string; detail?: string }) {
  const logo = teamLogo(game, side);
  return <div className="matchup-team-section-title">
    {logo ? <img src={logo} alt="" width={34} height={34} /> : <span className="matchup-logo-fallback" />}
    <span><strong>{name}</strong>{detail ? <small>{detail}</small> : null}</span>
  </div>;
}

function hasNumber(value: number | null | undefined) {
  return value != null && Number.isFinite(value);
}

function AdvancedMatchup({ away, home }: { away: TeamPreview; home: TeamPreview }) {
  const awayRelative = away.relative;
  const homeRelative = home.relative;
  const throughWeek = Math.max(Number(awayRelative?.throughWeek || 0), Number(homeRelative?.throughWeek || 0));
  const hasAnyRelative = Boolean(awayRelative || homeRelative);
  const awayReady = Boolean(awayRelative?.enoughSample);
  const homeReady = Boolean(homeRelative?.enoughSample);

  if (!hasAnyRelative) {
    return <div className="matchup-tab-body">
      <p className="matchup-empty-copy">Validated national advanced ranks are not available for this matchup yet.</p>
    </div>;
  }

  return <div className="matchup-tab-body">
    <div className="matchup-rank-context">FBS national rank · through Week {throughWeek || "—"} · #1 is best</div>

    <section className="matchup-comparison-block">
      <div className="matchup-comparison-heading"><strong>TEAM STRENGTH</strong></div>
      <MetricRow label="Overall Adjusted EPA" away={valueRank(awayRelative?.overallValue, awayRelative?.overallRank, signed3)} home={valueRank(homeRelative?.overallValue, homeRelative?.overallRank, signed3)} />
      <MetricRow label="Adjusted EPA / Play" away={valueRank(awayRelative?.offense.adjustedEpa, awayRelative?.offense.adjustedEpaRank, signed3)} home={valueRank(homeRelative?.offense.adjustedEpa, homeRelative?.offense.adjustedEpaRank, signed3)} />
      <MetricRow label="FPI" away={valueRank(away.power?.fpi, away.power?.fpiRank, signed2)} home={valueRank(home.power?.fpi, home.power?.fpiRank, signed2)} />
    </section>

    <section className="matchup-comparison-block">
      <div className="matchup-comparison-heading matchup-possession-heading">
        <strong>WHEN {away.name.toUpperCase()} HAS THE BALL</strong>
        <span>{away.name} offense · {home.name} defense</span>
      </div>
      <MetricRow label="Adjusted EPA / Play" away={valueRank(awayRelative?.offense.adjustedEpa, awayRelative?.offense.adjustedEpaRank, signed3)} home={valueRank(homeRelative?.defense.adjustedEpa, homeRelative?.defense.adjustedEpaRank, signed3)} />
      <MetricRow label="Success Rate" away={valueRank(awayRelative?.offense.successRate, awayRelative?.offense.successRateRank, percent1)} home={valueRank(homeRelative?.defense.successRate, homeRelative?.defense.successRateRank, percent1)} />
      <MetricRow label="Explosive Play Rate" away={valueRank(awayRelative?.offense.explosivePlayRate, awayRelative?.offense.explosivePlayRank, percent1)} home={valueRank(homeRelative?.defense.explosivePlayRate, homeRelative?.defense.explosivePlayRank, percent1)} />
      <MetricRow label="Yards / Play" away={valueRank(awayRelative?.offense.yardsPerPlay, awayRelative?.offense.yardsPerPlayRank, number2)} home={valueRank(homeRelative?.defense.yardsPerPlay, homeRelative?.defense.yardsPerPlayRank, number2)} />
      <MetricRow label="Line Yards / Carry" away={valueRank(awayRelative?.offense.lineYards, awayRelative?.offense.lineYardsRank, number2)} home={valueRank(homeRelative?.defense.lineYards, homeRelative?.defense.lineYardsRank, number2)} />
      <MetricRow label="3rd Down Success Rate" away={valueRank(awayRelative?.offense.thirdDownRate, awayRelative?.offense.thirdDownRank, percent1)} home={valueRank(homeRelative?.defense.thirdDownRate, homeRelative?.defense.thirdDownRank, percent1)} />
    </section>

    <section className="matchup-comparison-block">
      <div className="matchup-comparison-heading matchup-possession-heading">
        <strong>WHEN {home.name.toUpperCase()} HAS THE BALL</strong>
        <span>{away.name} defense · {home.name} offense</span>
      </div>
      <MetricRow label="Adjusted EPA / Play" away={valueRank(awayRelative?.defense.adjustedEpa, awayRelative?.defense.adjustedEpaRank, signed3)} home={valueRank(homeRelative?.offense.adjustedEpa, homeRelative?.offense.adjustedEpaRank, signed3)} />
      <MetricRow label="Success Rate" away={valueRank(awayRelative?.defense.successRate, awayRelative?.defense.successRateRank, percent1)} home={valueRank(homeRelative?.offense.successRate, homeRelative?.offense.successRateRank, percent1)} />
      <MetricRow label="Explosive Play Rate" away={valueRank(awayRelative?.defense.explosivePlayRate, awayRelative?.defense.explosivePlayRank, percent1)} home={valueRank(homeRelative?.offense.explosivePlayRate, homeRelative?.offense.explosivePlayRank, percent1)} />
      <MetricRow label="Yards / Play" away={valueRank(awayRelative?.defense.yardsPerPlay, awayRelative?.defense.yardsPerPlayRank, number2)} home={valueRank(homeRelative?.offense.yardsPerPlay, homeRelative?.offense.yardsPerPlayRank, number2)} />
      <MetricRow label="Line Yards / Carry" away={valueRank(awayRelative?.defense.lineYards, awayRelative?.defense.lineYardsRank, number2)} home={valueRank(homeRelative?.offense.lineYards, homeRelative?.offense.lineYardsRank, number2)} />
      <MetricRow label="3rd Down Success Rate" away={valueRank(awayRelative?.defense.thirdDownRate, awayRelative?.defense.thirdDownRank, percent1)} home={valueRank(homeRelative?.offense.thirdDownRate, homeRelative?.offense.thirdDownRank, percent1)} />
    </section>

    {(!awayReady || !homeReady) && <p className="matchup-data-note">
      Advanced ranks are withheld until a team has at least 3 valid FBS games.
      {!awayReady && awayRelative ? ` ${away.name}: ${Math.round(Number(awayRelative.validGames || 0))} valid FBS games.` : ""}
      {!homeReady && homeRelative ? ` ${home.name}: ${Math.round(Number(homeRelative.validGames || 0))} valid FBS games.` : ""}
    </p>}
    {awayReady && homeReady && <p className="matchup-data-note">Opponent-adjusted weekly FBS ranks from SportsDataverse. Only relative national ranks are shown.</p>}
  </div>;
}

function ResultsTeam({ game, side, team, season }: { game: Game; side: "away" | "home"; team: TeamPreview; season: number }) {
  return <section className="matchup-list-section">
    <TeamSectionTitle game={game} side={side} name={team.name} detail={`${season} results`} />
    {!team.recent.length ? <p className="matchup-empty-copy">No results available.</p> : team.recent.map((row) => <div className="matchup-result-row" key={row.id}>
      <span className={row.result === "W" ? "matchup-result-win" : row.result === "L" ? "matchup-result-loss" : ""}>{row.result}</span>
      <div><strong>{row.home ? "vs" : "at"} {teamDisplayName("CFB", row.opponent)}</strong><small>Week {row.week}</small></div>
      <strong>{row.teamPoints}-{row.opponentPoints}</strong>
    </div>)}
  </section>;
}

function AtsTeam({ game, side, team }: { game: Game; side: "away" | "home"; team: TeamPreview }) {
  return <section className="matchup-list-section">
    <TeamSectionTitle game={game} side={side} name={team.name} detail={`${team.ats.wins}-${team.ats.losses}-${team.ats.pushes} ATS · Avg cover ${fmtSigned(team.ats.avgCoverMargin)}`} />
    {!team.ats.recent.length ? <p className="matchup-empty-copy">No prior spread results available.</p> : team.ats.recent.map((row) => <div className="matchup-result-row matchup-ats-result-row" key={row.id}>
      <span className={row.result === "W" ? "matchup-result-win" : row.result === "L" ? "matchup-result-loss" : ""}>{row.result}</span>
      <div><strong>{row.home ? "vs" : "at"} {teamDisplayName("CFB", row.opponent)} {spreadText(row.spread)}</strong><small>Cover margin {fmtSigned(row.coverMargin)}</small></div>
      <strong>{row.teamPoints}-{row.opponentPoints}</strong>
    </div>)}
  </section>;
}

export default function MatchupPreview({ game, onClose }: { game: Game; onClose: () => void }) {
  const [tab, setTab] = useState<PreviewTab>("overview");
  const [payload, setPayload] = useState<PreviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  const awayName = teamDisplayName("CFB", game.away_team);
  const homeName = teamDisplayName("CFB", game.home_team);
  const awaySpread = normalizeSpreadForSelectedTeam(game.away_team, game.current_spread_team, game.current_spread);
  const homeSpread = normalizeSpreadForSelectedTeam(game.home_team, game.current_spread_team, game.current_spread);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    const priorBodyOverflow = document.body.style.overflow;
    const priorHtmlOverflow = document.documentElement.style.overflow;
    const priorBodyOverscroll = document.body.style.overscrollBehavior;
    const priorHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overscrollBehavior = "none";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = priorBodyOverflow;
      document.documentElement.style.overflow = priorHtmlOverflow;
      document.body.style.overscrollBehavior = priorBodyOverscroll;
      document.documentElement.style.overscrollBehavior = priorHtmlOverscroll;
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");
      try {
        const token = window.localStorage.getItem("pickem_session_token");
        const params = new URLSearchParams({
          away: game.away_team,
          home: game.home_team,
          date: game.commence_time,
          week: String(game.week),
          year: String(new Date(game.commence_time).getUTCFullYear())
        });
        const awayId = espnTeamIdFromLogo(game.away_logo_url);
        const homeId = espnTeamIdFromLogo(game.home_logo_url);
        if (awayId) params.set("awayId", awayId);
        if (homeId) params.set("homeId", homeId);
        const response = await fetch(`/api/cfb-matchup-preview?${params.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: "no-store",
          signal: controller.signal
        });
        const next = await response.json();
        if (!response.ok) throw new Error(next.code === "CFBD_NOT_CONFIGURED" ? "Matchup analytics are being connected." : next.error || "Matchup preview could not load.");
        if (!cancelled) setPayload(next);
      } catch (err) {
        if (!cancelled && !(err instanceof DOMException && err.name === "AbortError")) {
          setError(err instanceof Error ? err.message : "Matchup preview could not load.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [game.away_team, game.home_team, game.away_logo_url, game.home_logo_url, game.commence_time, game.week]);

  const tabs = useMemo(() => ([
    ["overview", "Overview"],
    ["advanced", "Advanced"],
    ["recent", "Results"],
    ["ats", "ATS"],
    ["history", "History"]
  ] as Array<[PreviewTab, string]>), []);

  if (!mounted) return null;

  return createPortal(<div className="matchup-preview-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="matchup-preview-sheet" role="dialog" aria-modal="true" aria-label={`${awayName} at ${homeName} matchup preview`} onClick={(event) => event.stopPropagation()}>
      <header className="matchup-preview-header">
        <div><span>MATCHUP PREVIEW</span></div>
        <button type="button" className="matchup-preview-close" onClick={onClose} aria-label="Close matchup preview"><X size={20} /></button>
      </header>

      <div className="matchup-preview-hero">
        <div className="matchup-preview-team">
          {game.away_logo_url ? <img src={game.away_logo_url} alt="" width={52} height={52} /> : <span className="matchup-logo-fallback" />}
          <span className="matchup-preview-team-name">{game.away_rank ? <small>#{game.away_rank}</small> : null}<strong>{awayName}</strong></span>
          <span className="matchup-preview-team-spread">{spreadText(awaySpread)}</span>
        </div>
        <div className="matchup-preview-at"><span>AT</span></div>
        <div className="matchup-preview-team">
          {game.home_logo_url ? <img src={game.home_logo_url} alt="" width={52} height={52} /> : <span className="matchup-logo-fallback" />}
          <span className="matchup-preview-team-name">{game.home_rank ? <small>#{game.home_rank}</small> : null}<strong>{homeName}</strong></span>
          <span className="matchup-preview-team-spread">{spreadText(homeSpread)}</span>
        </div>
      </div>

      <nav className="matchup-preview-tabs" aria-label="Matchup preview sections">
        {tabs.map(([id, label]) => <button type="button" key={id} className={tab === id ? "active" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>{label}</button>)}
      </nav>

      <div className="matchup-preview-scroll">
        {loading && <div className="matchup-preview-loading"><LoaderCircle size={21} /><span>Loading matchup data…</span></div>}
        {!loading && error && <div className="matchup-preview-unavailable"><strong>Preview foundation is ready.</strong><p>{error}</p><small>The pick board and spread are unchanged.</small></div>}

        {!loading && payload && tab === "overview" && <div className="matchup-tab-body">
          <section className="matchup-comparison-block">
            <div className="matchup-comparison-heading"><strong>OVERVIEW</strong></div>
            <MetricRow label="Record" away={`${payload.teams.away.record.wins}-${payload.teams.away.record.losses}`} home={`${payload.teams.home.record.wins}-${payload.teams.home.record.losses}`} explain={false} />
            <MetricRow label="Overall Adjusted EPA" away={valueRank(payload.teams.away.relative?.overallValue, payload.teams.away.relative?.overallRank, signed3)} home={valueRank(payload.teams.home.relative?.overallValue, payload.teams.home.relative?.overallRank, signed3)} />
            <MetricRow label="Adjusted EPA / Play" away={valueRank(payload.teams.away.relative?.offense.adjustedEpa, payload.teams.away.relative?.offense.adjustedEpaRank, signed3)} home={valueRank(payload.teams.home.relative?.offense.adjustedEpa, payload.teams.home.relative?.offense.adjustedEpaRank, signed3)} />
            <MetricRow label="FPI" away={valueRank(payload.teams.away.power?.fpi, payload.teams.away.power?.fpiRank, signed2)} home={valueRank(payload.teams.home.power?.fpi, payload.teams.home.power?.fpiRank, signed2)} />
          </section>

          <p className="matchup-data-note">National ranks use the last completed weekly snapshot before this matchup. Advanced ranks require at least 3 valid FBS games.</p>
        </div>}

        {!loading && payload && tab === "advanced" && <AdvancedMatchup away={payload.teams.away} home={payload.teams.home} />}

        {!loading && payload && tab === "recent" && <div className="matchup-tab-body matchup-split-lists">
          <ResultsTeam game={game} side="away" team={payload.teams.away} season={payload.season} />
          <ResultsTeam game={game} side="home" team={payload.teams.home} season={payload.season} />
        </div>}

        {!loading && payload && tab === "ats" && <div className="matchup-tab-body matchup-split-lists">
          <AtsTeam game={game} side="away" team={payload.teams.away} />
          <AtsTeam game={game} side="home" team={payload.teams.home} />
        </div>}

        {!loading && payload && tab === "history" && <div className="matchup-tab-body">
          {!payload.headToHead ? <p className="matchup-empty-copy">Head-to-head history is unavailable.</p> : <>
            <section className="matchup-series-summary">
              <strong>{payload.headToHead.team1Wins}-{payload.headToHead.team2Wins}{payload.headToHead.ties ? `-${payload.headToHead.ties}` : ""}</strong>
              <span>{payload.headToHead.team1} vs {payload.headToHead.team2}</span>
            </section>
            <section className="matchup-list-section">
              {!payload.headToHead.games.length ? <p className="matchup-empty-copy">No prior meetings found.</p> : payload.headToHead.games.map((row) => <div className="matchup-history-row" key={`${row.season}-${row.week}-${row.date}`}>
                <span>{row.season}</span>
                <div><strong>{teamDisplayName("CFB", row.awayTeam)} {row.awayScore} · {teamDisplayName("CFB", row.homeTeam)} {row.homeScore}</strong><small>{row.venue || (row.neutralSite ? "Neutral site" : "Previous meeting")}</small></div>
              </div>)}
            </section>
          </>}
        </div>}
      </div>
    </section>
  </div>, document.body);
}
