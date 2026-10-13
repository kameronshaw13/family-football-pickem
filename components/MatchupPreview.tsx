"use client";

import useGameSheetDismiss from "@/hooks/useGameSheetDismiss";


import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { LoaderCircle, X } from "lucide-react";
import type { Game } from "@/lib/types";
import type { MatchupPayload, MatchupTeam, MatchupHistory } from "@/lib/cfbMatchup";
import { createAsyncCache } from "@/lib/asyncCache";
import { formatOrdinalDate, matchupDateFormatter } from "@/lib/displayDates";
import { normalizeSpreadForSelectedTeam, spreadText } from "@/lib/spreads";
import { teamDisplayName } from "@/lib/teamNames";

type Tab = "matchup" | "form" | "history";
type Unit = NonNullable<MatchupTeam["relative"]>["offense"];
const getPreview = createAsyncCache<MatchupPayload>(5 * 60_000, 24);
const getHistory = createAsyncCache<MatchupHistory>(15 * 60_000, 24);
const signed = (value: number, digits = 1) => `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
const metrics: Array<{ label: string; value: keyof Unit; rank: keyof Unit; format: (value: number) => string }> = [
  { label: "Adj. EPA / play", value: "adjustedEpa", rank: "adjustedEpaRank", format: value => signed(value, 3) },
  { label: "EPA / drive", value: "epaPerDrive", rank: "epaPerDriveRank", format: value => signed(value, 2) },
  { label: "Available yards", value: "availableYardsRate", rank: "availableYardsRateRank", format: value => `${(value * 100).toFixed(1)}%` },
  { label: "Early-down EPA", value: "earlyDownEpa", rank: "earlyDownEpaRank", format: value => signed(value, 3) },
  { label: "Late-down success", value: "lateDownRate", rank: "lateDownRank", format: value => `${(value * 100).toFixed(1)}%` },
  { label: "Success rate", value: "successRate", rank: "successRateRank", format: value => `${(value * 100).toFixed(1)}%` },
  { label: "Explosive rate", value: "explosivePlayRate", rank: "explosivePlayRank", format: value => `${(value * 100).toFixed(1)}%` },
  { label: "3rd-down success", value: "thirdDownRate", rank: "thirdDownRank", format: value => `${(value * 100).toFixed(1)}%` }
];

async function requestData<T>(gameId: string, section: string, token: string): Promise<T> {
  const response = await fetch(`/api/cfb-matchup-preview?gameId=${encodeURIComponent(gameId)}&section=${section}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store", signal: AbortSignal.timeout(25_000)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Matchup data could not load.");
  return payload as T;
}

function Logo({ src, size = 40 }: { src?: string | null; size?: number }) {
  return src ? <Image unoptimized src={src} alt="" width={size} height={size} /> : <span className="matchup-logo-fallback" />;
}

function RecordValue({ wins, losses, pushes = null }: { wins: number; losses: number; pushes?: number | null }) {
  const aria = pushes == null
    ? `${wins} wins, ${losses} losses`
    : `${wins} wins, ${losses} losses, ${pushes} pushes`;
  return <span className="matchup-record-value" aria-label={aria}>{wins}-{losses}{pushes != null ? `-${pushes}` : ""}</span>;
}

function InlineDot() {
  return <span className="matchup-inline-dot" aria-hidden="true" />;
}

function rankTone(rank?: number | null) {
  if (rank == null || !Number.isFinite(rank)) return "";
  if (rank <= 25) return " rank-good";
  if (rank <= 75) return " rank-average";
  return " rank-bad";
}

function RankValue({ value, rank, format }: { value?: number | null; rank?: number | null; format: (value: number) => string }) {
  const available = value != null && Number.isFinite(value);
  return <div className="matchup-rank-value">
    <strong>{available ? format(value) : "—"}</strong>
    {available && rank != null && <small className={rankTone(rank)}>#{Math.round(rank)}</small>}
  </div>;
}

function MetricLabel({ label }: { label: string }) {
  return <span className="matchup-metric-label"><strong>{label}</strong></span>;
}

function Comparison({ away, home, awayLogo, homeLogo, possession }: { away: MatchupTeam; home: MatchupTeam; awayLogo?: string | null; homeLogo?: string | null; possession: "away" | "home" }) {
  const left = possession === "away" ? away.relative?.offense : away.relative?.defense;
  const right = possession === "home" ? home.relative?.offense : home.relative?.defense;
  const leftRole = possession === "away" ? "OFFENSE" : "DEFENSE";
  const rightRole = possession === "home" ? "OFFENSE" : "DEFENSE";
  return <section className="matchup-comparison-block">
    <div className="matchup-column-heads matchup-role-heads">
      <span className="matchup-role-side matchup-role-left">
        <Logo src={awayLogo} size={24} />
        <span className="matchup-role-copy"><small>{away.name}</small><strong>{leftRole}</strong></span>
      </span>
      <span className="matchup-versus">VS</span>
      <span className="matchup-role-side matchup-role-right">
        <span className="matchup-role-copy"><small>{home.name}</small><strong>{rightRole}</strong></span>
        <Logo src={homeLogo} size={24} />
      </span>
    </div>
    {metrics.map(metric => <div className="matchup-metric-row" key={metric.value}>
      <RankValue value={left?.[metric.value]} rank={left?.[metric.rank]} format={metric.format} />
      <MetricLabel label={metric.label} />
      <RankValue value={right?.[metric.value]} rank={right?.[metric.rank]} format={metric.format} />
    </div>)}
  </section>;
}

function Matchup({ payload, awayLogo, homeLogo }: { payload: MatchupPayload; awayLogo?: string | null; homeLogo?: string | null }) {
  const { away, home } = payload.teams;
  const sampleNotes = [away, home].flatMap(team => {
    if (!team.relative) return [`${team.name}: advanced snapshot pending`];
    if (team.relative.limitedSample) return [`${team.name}: early sample (${team.relative.validGames ?? 0} FBS ${team.relative.validGames === 1 ? "game" : "games"})`];
    return [];
  });
  return <div className="matchup-tab-body">
    <section className="matchup-strength">
      <div className="matchup-section-heading"><h3>Overall Strength</h3></div>
      <div className="matchup-column-heads matchup-strength-heads">
        <span className="matchup-strength-team matchup-strength-left"><Logo src={awayLogo} size={20} /><strong>{away.name}</strong></span>
        <span>STAT</span>
        <span className="matchup-strength-team matchup-strength-right"><strong>{home.name}</strong><Logo src={homeLogo} size={20} /></span>
      </div>
      <div className="matchup-metric-row"><RankValue value={away.relative?.overallValue} rank={away.relative?.overallRank} format={v => signed(v, 3)} /><MetricLabel label="Adj. net EPA" /><RankValue value={home.relative?.overallValue} rank={home.relative?.overallRank} format={v => signed(v, 3)} /></div>
      <div className="matchup-metric-row"><RankValue value={away.power?.fpi} rank={away.power?.fpiRank} format={signed} /><MetricLabel label="ESPN FPI" /><RankValue value={home.power?.fpi} rank={home.power?.fpiRank} format={signed} /></div>
    </section>
    {sampleNotes.length > 0 && <p className="matchup-data-note"><strong>Limited sample:</strong> {sampleNotes.join(" · ")}.</p>}
    <Comparison away={away} home={home} awayLogo={awayLogo} homeLogo={homeLogo} possession="away" />
    <Comparison away={away} home={home} awayLogo={awayLogo} homeLogo={homeLogo} possession="home" />
  </div>;
}

function FormTeam({ team, logo }: { team: MatchupTeam; logo?: string | null }) {
  const count = team.ats.wins + team.ats.losses + team.ats.pushes;
  const coverByWeek = new Map(team.ats.recent.map(result => [result.week, result]));
  return <section className="matchup-form-team">
    <div className="matchup-form-heading"><Logo src={logo} size={42} /><h3>{team.name}</h3></div>
    <div className="matchup-form-stats">
      <div><small>RECORD</small><strong>{team.resultsAvailable ? <RecordValue wins={team.record.wins} losses={team.record.losses} /> : "—"}</strong></div>
      <div><small>AVG. MARGIN</small><strong>{team.scoring.margin == null ? "—" : signed(team.scoring.margin)}</strong></div>
      <div><small>ATS</small><strong>{count ? <RecordValue wins={team.ats.wins} losses={team.ats.losses} pushes={team.ats.pushes} /> : "—"}</strong></div>
      <div><small>AVG. COVER</small><strong>{team.ats.avgCoverMargin == null ? "—" : signed(team.ats.avgCoverMargin)}</strong></div>
    </div>
    <h4>Season Games</h4>
    {team.recent.length ? team.recent.map(row => {
      const cover = coverByWeek.get(row.week);
      return <div className="matchup-result-row matchup-form-combined-row" key={row.id}>
        <span className={row.result === "W" ? "matchup-result-win" : row.result === "L" ? "matchup-result-loss" : "matchup-result-push"}>{row.result}</span>
        <div className="matchup-result-opponent">
          <strong>{row.home ? "vs" : "at"} {teamDisplayName("CFB", row.opponent)}</strong>
          <small>Week {row.week}{cover ? <> <span className="matchup-inline-dot matchup-form-week-dot" aria-hidden="true" /> Spread {spreadText(cover.spread)}</> : null}</small>
        </div>
        <div className="matchup-result-outcome">
          <strong>{row.teamPoints}-{row.opponentPoints}</strong>
          {cover && <small>ATS <b className={cover.result === "W" ? "matchup-cover-win" : cover.result === "L" ? "matchup-cover-loss" : "matchup-cover-push"}>{cover.result}</b></small>}
        </div>
      </div>;
    }) : <p className="matchup-empty-copy">No completed games available.</p>}
  </section>;
}

function History({ history, away, home, awayLogo, homeLogo }: { history: MatchupHistory; away: string; home: string; awayLogo?: string | null; homeLogo?: string | null }) {
  const wins = history.games.filter(row => Number(row.teamPoints) > Number(row.opponentPoints)).length;
  const losses = history.games.filter(row => Number(row.teamPoints) < Number(row.opponentPoints)).length;
  const meetingCount = history.games.length;
  return <div className="matchup-tab-body matchup-history-body">
    <div className="matchup-section-heading"><h3>Head-to-head</h3></div>
    {!history.complete && meetingCount < 10 && <p className="matchup-data-note">Showing verified previous meetings available from ESPN.</p>}
    {meetingCount ? <>
      <div className="matchup-series-summary">
        <div className="matchup-series-side">
          <Logo src={awayLogo} size={36} />
          <strong title={away}>{away}</strong>
          <span className="matchup-series-wins"><b>{wins}</b> {wins === 1 ? "win" : "wins"}</span>
        </div>
        <div className="matchup-series-center"><small>LAST</small><strong>{meetingCount}</strong><small>{meetingCount === 1 ? "MEETING" : "MEETINGS"}</small></div>
        <div className="matchup-series-side">
          <Logo src={homeLogo} size={36} />
          <strong title={home}>{home}</strong>
          <span className="matchup-series-wins"><b>{losses}</b> {losses === 1 ? "win" : "wins"}</span>
        </div>
      </div>
      <div className="matchup-history-list">
        {history.games.map(row => {
          // Games are returned from the selected away team's perspective.
          // Reorder each historical result by the actual away/home side.
          const awayWasHome = row.home;
          const visitorName = awayWasHome ? home : away;
          const hostName = awayWasHome ? away : home;
          const visitorLogo = awayWasHome ? homeLogo : awayLogo;
          const hostLogo = awayWasHome ? awayLogo : homeLogo;
          const visitorScore = Number(awayWasHome ? row.opponentPoints : row.teamPoints);
          const hostScore = Number(awayWasHome ? row.teamPoints : row.opponentPoints);
          return <article className="matchup-history-game" key={row.id}>
            <div className="matchup-history-game-meta">
              <time dateTime={row.date}>{new Date(row.date).getUTCFullYear()}</time>
              <span>{row.neutralSite ? "Neutral site" : `Home: ${hostName}`}</span>
            </div>
            <div className="matchup-history-scoreboard">
              <div className={visitorScore > hostScore ? "matchup-history-score-team winner" : "matchup-history-score-team"}>
                <Logo src={visitorLogo} size={24} />
                <span>{visitorName}</span>
                <small>AWAY</small>
                <strong>{visitorScore}</strong>
              </div>
              <div className={hostScore > visitorScore ? "matchup-history-score-team winner" : "matchup-history-score-team"}>
                <Logo src={hostLogo} size={24} />
                <span>{hostName}</span>
                <small>{row.neutralSite ? "NEUTRAL" : "HOME"}</small>
                <strong>{hostScore}</strong>
              </div>
            </div>
          </article>;
        })}
      </div>
    </> : <p className="matchup-empty-copy">{history.complete ? "No verified previous meetings found." : "History is temporarily unavailable."}</p>}
  </div>;
}

export default function MatchupPreview({ game, onClose }: { game: Game; onClose: () => void; showModel?: boolean; modelGroup?: string }) {
  const [tab, setTab] = useState<Tab>("matchup");
  const [payload, setPayload] = useState<MatchupPayload | null>(null);
  const [history, setHistory] = useState<MatchupHistory | null>(null);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [retry, setRetry] = useState(0);
  const [mounted, setMounted] = useState(false);
  const sheet = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const closeWithMotion = useGameSheetDismiss(sheet, mounted, onClose);
  const away = teamDisplayName("CFB", game.away_team);
  const home = teamDisplayName("CFB", game.home_team);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    const priorFocus = document.activeElement as HTMLElement | null;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // The global bottom navigation remains available while viewing matchups.
    let switchedDestination = false;
    const onMainNavigation = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest(".primary-nav button")) {
        switchedDestination = true;
        close.current();
      }
    };
    document.addEventListener("click", onMainNavigation);
    sheet.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close.current(); }

    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = priorOverflow;
      document.removeEventListener("click", onMainNavigation);
      if (!switchedDestination) priorFocus?.focus();
    };
  }, [mounted]);

  useEffect(() => {
    let active = true;
    setPayload(null); setHistory(null); setError(""); setHistoryError(""); setTab("matchup");
    const token = window.localStorage.getItem("pickem_session_token") || "";
    void getPreview(`${token}:${game.id}`, () => requestData<MatchupPayload>(game.id, "matchup", token))
      .then(data => { if (active) setPayload(data); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Could not load matchup."); });
    return () => { active = false; };
  }, [game.id, retry]);

  useEffect(() => {
    if (tab !== "history" || history) return;
    let active = true;
    setHistoryError("");
    const token = window.localStorage.getItem("pickem_session_token") || "";
    void getHistory(`${token}:${game.id}`, () => requestData<MatchupHistory>(game.id, "history", token))
      .then(data => { if (active) setHistory(data); })
      .catch(cause => { if (active) setHistoryError(cause instanceof Error ? cause.message : "Could not load history."); });
    return () => { active = false; };
  }, [tab, game.id, history, retry]);

  if (!mounted) return null;
  const tabs: Array<[Tab, string]> = [["matchup", "Analytics"], ["form", "Form"], ["history", "History"]];
  return createPortal(<div className="matchup-preview-backdrop" onClick={event => { if (event.target === event.currentTarget) closeWithMotion(); }}>
    <section ref={sheet} className="matchup-preview-sheet" role="dialog" aria-modal="false" aria-label={`${away} at ${home} matchup preview`}>
      <header className="matchup-preview-header">
        <div className="matchup-detail-title">
          
          <strong>{away} at {home}</strong>
        </div>
        <button className="matchup-preview-close" type="button" onClick={closeWithMotion} aria-label="Close matchup preview"><X size={18} /></button>
      </header>
      <div className="matchup-preview-hero">
        <div className="matchup-preview-kickoff">{formatOrdinalDate(matchupDateFormatter, new Date(game.commence_time))} CT</div>
        {(["away", "home"] as const).map(side => <div className="matchup-preview-team" key={side}><Logo src={side === "away" ? game.away_logo_url : game.home_logo_url} size={46} /><strong>{side === "away" ? away : home}</strong><span>{payload?.teams[side].resultsAvailable ? <RecordValue wins={payload.teams[side].record.wins} losses={payload.teams[side].record.losses} /> : "—"}{normalizeSpreadForSelectedTeam(side === "away" ? game.away_team : game.home_team, game.current_spread_team, game.current_spread) != null && <b>{spreadText(normalizeSpreadForSelectedTeam(side === "away" ? game.away_team : game.home_team, game.current_spread_team, game.current_spread))}</b>}</span></div>)}
        <span className="matchup-center-at" aria-hidden="true">AT</span>
      </div>
      <nav className="matchup-preview-tabs" aria-label="Matchup sections">{tabs.map(([id, label]) => <button type="button" key={id} aria-current={tab === id ? "page" : undefined} className={tab === id ? "active" : ""} onClick={() => { setTab(id); sheet.current?.querySelector(".matchup-preview-scroll")?.scrollTo(0, 0); }}>{label}</button>)}</nav>
      <div className="matchup-preview-scroll">
        {error && <div className="matchup-empty-copy" role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
        {!payload && !error && <div className="matchup-preview-loading" role="status"><LoaderCircle size={22} /><span>Loading matchup…</span></div>}
        {payload && tab === "matchup" && <Matchup payload={payload} awayLogo={game.away_logo_url} homeLogo={game.home_logo_url} />}
        {payload && tab === "form" && <div className="matchup-tab-body"><div className="matchup-split-lists"><FormTeam team={payload.teams.away} logo={game.away_logo_url} /><FormTeam team={payload.teams.home} logo={game.home_logo_url} /></div></div>}
        {payload && tab === "history" && (history ? <History history={history} away={away} home={home} awayLogo={game.away_logo_url} homeLogo={game.home_logo_url} /> : historyError ? <div className="matchup-empty-copy" role="alert"><p>{historyError}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div> : <div className="matchup-preview-loading" role="status"><LoaderCircle size={22} /><span>Loading history…</span></div>)}
      </div>
    </section>
  </div>, document.body);
}
