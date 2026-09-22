"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, LoaderCircle, X } from "lucide-react";
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
    offense?: Record<string, any>;
    defense?: Record<string, any>;
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

function MetricRow({ label, away, home }: { label: string; away: string; home: string }) {
  return <div className="matchup-metric-row">
    <strong>{away}</strong>
    <span>{label}</span>
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

function advancedMetric(block: Record<string, any> | undefined, path: string[]) {
  let current: any = block;
  for (const key of path) {
    if (current == null || typeof current !== "object") return null;
    current = current[key];
  }
  const value = Number(current);
  return Number.isFinite(value) ? value : null;
}

function AdvancedMatchup({ away, home }: { away: TeamPreview; home: TeamPreview }) {
  const awayOffense = away.advanced?.offense;
  const awayDefense = away.advanced?.defense;
  const homeOffense = home.advanced?.offense;
  const homeDefense = home.advanced?.defense;
  const hasDetailedAdvanced = Boolean(awayOffense || awayDefense || homeOffense || homeDefense);

  if (!hasDetailedAdvanced) {
    return <div className="matchup-tab-body">
      <section className="matchup-comparison-block">
        <div className="matchup-comparison-heading"><strong>EFFICIENCY SNAPSHOT</strong><span>ESPN + pick’em data</span></div>
        <MetricRow label="Yards / Game" away={fmt(away.regular.yardsPerGame)} home={fmt(home.regular.yardsPerGame)} />
        <MetricRow label="Pass Yards / Game" away={fmt(away.regular.passYardsPerGame)} home={fmt(home.regular.passYardsPerGame)} />
        <MetricRow label="Rush Yards / Game" away={fmt(away.regular.rushYardsPerGame)} home={fmt(home.regular.rushYardsPerGame)} />
        <MetricRow label="3rd Down" away={fmtPct(away.regular.thirdDownPct)} home={fmtPct(home.regular.thirdDownPct)} />
        <MetricRow label="Turnovers / Game" away={fmt(away.regular.turnoversPerGame)} home={fmt(home.regular.turnoversPerGame)} />
        <MetricRow label="Avg Scoring Margin" away={fmtSigned(away.scoring.margin)} home={fmtSigned(home.scoring.margin)} />
      </section>
      <p className="matchup-data-note">Success rate, PPA, explosiveness, line yards and havoc will layer in when the advanced feed is connected.</p>
    </div>;
  }

  const block = (title: string, leftName: string, left: Record<string, any> | undefined, rightName: string, right: Record<string, any> | undefined) => <section className="matchup-comparison-block">
    <div className="matchup-comparison-heading"><strong>{title}</strong><span>{leftName} offense vs {rightName} defense</span></div>
    <MetricRow label="Success Rate" away={fmtPct(advancedMetric(left, ["successRate"]))} home={fmtPct(advancedMetric(right, ["successRate"]))} />
    <MetricRow label="PPA / Play" away={fmt(advancedMetric(left, ["ppa"]), 3)} home={fmt(advancedMetric(right, ["ppa"]), 3)} />
    <MetricRow label="Explosiveness" away={fmt(advancedMetric(left, ["explosiveness"]), 2)} home={fmt(advancedMetric(right, ["explosiveness"]), 2)} />
    <MetricRow label="Pass Success" away={fmtPct(advancedMetric(left, ["passingPlays", "successRate"]))} home={fmtPct(advancedMetric(right, ["passingPlays", "successRate"]))} />
    <MetricRow label="Rush Success" away={fmtPct(advancedMetric(left, ["rushingPlays", "successRate"]))} home={fmtPct(advancedMetric(right, ["rushingPlays", "successRate"]))} />
    <MetricRow label="Line Yards" away={fmt(advancedMetric(left, ["lineYards"]), 2)} home={fmt(advancedMetric(right, ["lineYards"]), 2)} />
    <MetricRow label="Pts / Opportunity" away={fmt(advancedMetric(left, ["pointsPerOpportunity"]), 2)} home={fmt(advancedMetric(right, ["pointsPerOpportunity"]), 2)} />
  </section>;

  return <div className="matchup-tab-body">
    {block("WHEN AWAY HAS THE BALL", away.name, awayOffense, home.name, homeDefense)}
    {block("WHEN HOME HAS THE BALL", home.name, homeOffense, away.name, awayDefense)}
    <section className="matchup-comparison-block">
      <div className="matchup-comparison-heading"><strong>DISRUPTION</strong><span>Defensive havoc</span></div>
      <MetricRow label="Havoc Rate" away={fmtPct(advancedMetric(awayDefense, ["havoc", "total"]))} home={fmtPct(advancedMetric(homeDefense, ["havoc", "total"]))} />
      <MetricRow label="Front 7 Havoc" away={fmtPct(advancedMetric(awayDefense, ["havoc", "frontSeven"]))} home={fmtPct(advancedMetric(homeDefense, ["havoc", "frontSeven"]))} />
      <MetricRow label="DB Havoc" away={fmtPct(advancedMetric(awayDefense, ["havoc", "db"]))} home={fmtPct(advancedMetric(homeDefense, ["havoc", "db"]))} />
      <MetricRow label="Stuff Rate" away={fmtPct(advancedMetric(awayDefense, ["stuffRate"]))} home={fmtPct(advancedMetric(homeDefense, ["stuffRate"]))} />
    </section>
  </div>;
}

function RecentTeam({ game, side, team }: { game: Game; side: "away" | "home"; team: TeamPreview }) {
  return <section className="matchup-list-section">
    <TeamSectionTitle game={game} side={side} name={team.name} detail="Last 5 before this matchup" />
    {!team.recent.length ? <p className="matchup-empty-copy">No prior results available.</p> : team.recent.map((row) => <div className="matchup-result-row" key={row.id}>
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

  const awayName = teamDisplayName("CFB", game.away_team);
  const homeName = teamDisplayName("CFB", game.home_team);
  const awaySpread = normalizeSpreadForSelectedTeam(game.away_team, game.current_spread_team, game.current_spread);
  const homeSpread = normalizeSpreadForSelectedTeam(game.home_team, game.current_spread_team, game.current_spread);

  useEffect(() => {
    const scrollY = window.scrollY;
    const prior = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overflow: document.body.style.overflow
    };
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.position = prior.position;
      document.body.style.top = prior.top;
      document.body.style.width = prior.width;
      document.body.style.overflow = prior.overflow;
      window.scrollTo(0, scrollY);
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
    ["recent", "Recent"],
    ["ats", "ATS"],
    ["history", "History"]
  ] as Array<[PreviewTab, string]>), []);

  return <div className="matchup-preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="matchup-preview-sheet" role="dialog" aria-modal="true" aria-label={`${awayName} at ${homeName} matchup preview`}>
      <header className="matchup-preview-header">
        <button type="button" className="matchup-preview-back" onClick={onClose} aria-label="Close matchup preview"><ChevronLeft size={19} /></button>
        <div><span>CFB MATCHUP PREVIEW</span><strong>Week {game.week}</strong></div>
        <button type="button" className="matchup-preview-close" onClick={onClose} aria-label="Close matchup preview"><X size={18} /></button>
      </header>

      <div className="matchup-preview-hero">
        <div className="matchup-preview-team">
          {game.away_logo_url ? <img src={game.away_logo_url} alt="" width={52} height={52} /> : <span className="matchup-logo-fallback" />}
          <strong>{awayName}</strong>
          <span>{spreadText(awaySpread)}</span>
        </div>
        <div className="matchup-preview-at"><span>AT</span><small>{payload ? `${payload.season} · THROUGH WK ${payload.throughWeek}` : "MATCHUP"}</small></div>
        <div className="matchup-preview-team">
          {game.home_logo_url ? <img src={game.home_logo_url} alt="" width={52} height={52} /> : <span className="matchup-logo-fallback" />}
          <strong>{homeName}</strong>
          <span>{spreadText(homeSpread)}</span>
        </div>
      </div>

      <nav className="matchup-preview-tabs" aria-label="Matchup preview sections">
        {tabs.map(([id, label]) => <button type="button" key={id} className={tab === id ? "active" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>{label}</button>)}
      </nav>

      <div className="matchup-preview-scroll">
        {loading && <div className="matchup-preview-loading"><LoaderCircle size={21} /><span>Loading matchup data…</span></div>}
        {!loading && error && <div className="matchup-preview-unavailable"><strong>Preview foundation is ready.</strong><p>{error}</p><small>The pick board and spread are unchanged.</small></div>}

        {!loading && payload && tab === "overview" && <div className="matchup-tab-body">
          <div className="matchup-columns-header">
            <TeamColumnLabel game={game} side="away" name={payload.teams.away.name} />
            <span>TEAM COMPARISON</span>
            <TeamColumnLabel game={game} side="home" name={payload.teams.home.name} />
          </div>
          <section className="matchup-comparison-block">
            <MetricRow label="Record" away={`${payload.teams.away.record.wins}-${payload.teams.away.record.losses}`} home={`${payload.teams.home.record.wins}-${payload.teams.home.record.losses}`} />
            <MetricRow label="Points / Game" away={fmt(payload.teams.away.scoring.ppg)} home={fmt(payload.teams.home.scoring.ppg)} />
            <MetricRow label="Points Allowed" away={fmt(payload.teams.away.scoring.allowedPpg)} home={fmt(payload.teams.home.scoring.allowedPpg)} />
            <MetricRow label="Avg Margin" away={fmtSigned(payload.teams.away.scoring.margin)} home={fmtSigned(payload.teams.home.scoring.margin)} />
            <MetricRow label="Yards / Game" away={fmt(payload.teams.away.regular.yardsPerGame)} home={fmt(payload.teams.home.regular.yardsPerGame)} />
            <MetricRow label="Pass Yards / Game" away={fmt(payload.teams.away.regular.passYardsPerGame)} home={fmt(payload.teams.home.regular.passYardsPerGame)} />
            <MetricRow label="Rush Yards / Game" away={fmt(payload.teams.away.regular.rushYardsPerGame)} home={fmt(payload.teams.home.regular.rushYardsPerGame)} />
            <MetricRow label="3rd Down" away={fmtPct(payload.teams.away.regular.thirdDownPct)} home={fmtPct(payload.teams.home.regular.thirdDownPct)} />
          </section>
          <section className="matchup-comparison-block">
            <div className="matchup-comparison-heading"><strong>POWER RATINGS</strong><span>SP+</span></div>
            <MetricRow label="SP+ Rank" away={payload.teams.away.sp?.ranking ? `#${payload.teams.away.sp.ranking}` : "—"} home={payload.teams.home.sp?.ranking ? `#${payload.teams.home.sp.ranking}` : "—"} />
            <MetricRow label="SP+ Rating" away={fmtSigned(payload.teams.away.sp?.rating)} home={fmtSigned(payload.teams.home.sp?.rating)} />
            <MetricRow label="Offense Rank" away={payload.teams.away.sp?.offense?.ranking ? `#${payload.teams.away.sp.offense.ranking}` : "—"} home={payload.teams.home.sp?.offense?.ranking ? `#${payload.teams.home.sp.offense.ranking}` : "—"} />
            <MetricRow label="Defense Rank" away={payload.teams.away.sp?.defense?.ranking ? `#${payload.teams.away.sp.defense.ranking}` : "—"} home={payload.teams.home.sp?.defense?.ranking ? `#${payload.teams.home.sp.defense.ranking}` : "—"} />
          </section>
          <section className="matchup-comparison-block">
            <div className="matchup-comparison-heading"><strong>AGAINST THE SPREAD</strong><span>Season before this game</span></div>
            <MetricRow label="ATS Record" away={`${payload.teams.away.ats.wins}-${payload.teams.away.ats.losses}-${payload.teams.away.ats.pushes}`} home={`${payload.teams.home.ats.wins}-${payload.teams.home.ats.losses}-${payload.teams.home.ats.pushes}`} />
            <MetricRow label="Avg Cover Margin" away={fmtSigned(payload.teams.away.ats.avgCoverMargin)} home={fmtSigned(payload.teams.home.ats.avgCoverMargin)} />
          </section>
        </div>}

        {!loading && payload && tab === "advanced" && <AdvancedMatchup away={payload.teams.away} home={payload.teams.home} />}

        {!loading && payload && tab === "recent" && <div className="matchup-tab-body matchup-split-lists">
          <RecentTeam game={game} side="away" team={payload.teams.away} />
          <RecentTeam game={game} side="home" team={payload.teams.home} />
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
  </div>;
}
