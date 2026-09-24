"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { ArrowUpRight, LoaderCircle, X } from "lucide-react";
import type { Game } from "@/lib/types";
import type { MatchupPayload, MatchupTeam, MatchupHistory } from "@/lib/cfbMatchup";
import { createAsyncCache } from "@/lib/asyncCache";
import { formatOrdinalDate, matchupDateFormatter } from "@/lib/displayDates";
import { normalizeSpreadForSelectedTeam, spreadText } from "@/lib/spreads";
import { teamDisplayName } from "@/lib/teamNames";

type Tab = "matchup" | "form" | "history";
type Unit = NonNullable<MatchupTeam["relative"]>["offense"];
type MetricBasis = "raw" | "adjusted" | "model";
const getPreview = createAsyncCache<MatchupPayload>(5 * 60_000, 24);
const getHistory = createAsyncCache<MatchupHistory>(15 * 60_000, 24);
const signed = (value: number, digits = 1) => `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
const metrics: Array<{ label: string; detail: string; basis: MetricBasis; value: keyof Unit; rank: keyof Unit; format: (value: number) => string }> = [
  { label: "Play efficiency", detail: "EPA / play", basis: "adjusted", value: "adjustedEpa", rank: "adjustedEpaRank", format: value => signed(value, 3) },
  { label: "Consistency", detail: "Success rate", basis: "raw", value: "successRate", rank: "successRateRank", format: value => `${(value * 100).toFixed(1)}%` },
  { label: "Big plays", detail: "Explosive-play rate", basis: "raw", value: "explosivePlayRate", rank: "explosivePlayRank", format: value => `${(value * 100).toFixed(1)}%` },
  { label: "The trenches", detail: "Line yards / carry", basis: "raw", value: "lineYards", rank: "lineYardsRank", format: value => value.toFixed(2) },
  { label: "Third downs", detail: "Success rate", basis: "raw", value: "thirdDownRate", rank: "thirdDownRank", format: value => `${(value * 100).toFixed(1)}%` }
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

function RankValue({ value, rank, format, edge = false }: { value?: number | null; rank?: number | null; format: (value: number) => string; edge?: boolean }) {
  const available = value != null && Number.isFinite(value);
  return <div className={`matchup-rank-value${edge ? " has-edge" : ""}`}>
    <strong>{available && rank != null ? `#${Math.round(rank)}` : available ? format(value) : "—"}{edge && <ArrowUpRight size={12} aria-label="Higher national ranking" />}</strong>
    <small>{available && rank != null ? format(value) : available ? "Rank unavailable" : "Unavailable"}</small>
  </div>;
}

function BasisTag({ basis }: { basis: MetricBasis }) {
  const label = basis === "adjusted" ? "Opponent-adjusted" : basis === "model" ? "Predictive model" : "Raw";
  return <span className={`matchup-basis matchup-basis-${basis}`}>{label}</span>;
}

function MetricLabel({ label, detail, basis }: { label: string; detail: string; basis: MetricBasis }) {
  return <span className="matchup-metric-label"><strong>{label}</strong><span className="matchup-metric-meta"><small>{detail}</small><BasisTag basis={basis} /></span></span>;
}

function Comparison({ away, home, possession }: { away: MatchupTeam; home: MatchupTeam; possession: "away" | "home" }) {
  const offense = possession === "away" ? away : home;
  const left = possession === "away" ? away.relative?.offense : away.relative?.defense;
  const right = possession === "home" ? home.relative?.offense : home.relative?.defense;
  const sameSnapshot = away.relative?.throughWeek === home.relative?.throughWeek;
  return <section className="matchup-comparison-block">
    <div className="matchup-section-heading"><span className="matchup-eyebrow">THE MATCHUP</span><h3>When {offense.name} has the ball</h3></div>
    <div className="matchup-column-heads"><span>{away.name}<small>{possession === "away" ? "OFFENSE" : "DEFENSE"}</small></span><span>FBS RANK</span><span>{home.name}<small>{possession === "home" ? "OFFENSE" : "DEFENSE"}</small></span></div>
    {metrics.map(metric => {
      const l = left?.[metric.rank], r = right?.[metric.rank];
      const comparable = sameSnapshot && l != null && r != null;
      return <div className="matchup-metric-row" key={metric.value}>
        <RankValue value={left?.[metric.value]} rank={l} format={metric.format} edge={comparable && l < r} />
        <MetricLabel label={metric.label} detail={metric.detail} basis={metric.basis} />
        <RankValue value={right?.[metric.value]} rank={r} format={metric.format} edge={comparable && r < l} />
      </div>;
    })}
  </section>;
}

function Matchup({ payload }: { payload: MatchupPayload }) {
  const { away, home } = payload.teams;
  const fpiWeek = away.power?.throughWeek === home.power?.throughWeek ? away.power?.throughWeek : null;
  const sampleNotes = [away, home].flatMap(team => {
    if (!team.relative) return [`${team.name}: advanced snapshot pending`];
    if (team.relative.limitedSample) return [`${team.name}: early sample (${team.relative.validGames ?? 0} FBS ${team.relative.validGames === 1 ? "game" : "games"})`];
    return [];
  });
  return <div className="matchup-tab-body">
    <div className="matchup-freshness"><span>Advanced stats through Week {payload.throughWeek}</span><strong>#1 is best</strong></div>
    <section className="matchup-strength">
      <div className="matchup-section-heading"><span className="matchup-eyebrow">THE BIG PICTURE</span><h3>Team strength</h3></div>
      <div className="matchup-column-heads"><span>{away.name}</span><span>FBS RANK</span><span>{home.name}</span></div>
      <div className="matchup-metric-row"><RankValue value={away.relative?.overallValue} rank={away.relative?.overallRank} format={v => signed(v, 3)} /><MetricLabel label="Overall efficiency" detail="Net EPA" basis="adjusted" /><RankValue value={home.relative?.overallValue} rank={home.relative?.overallRank} format={v => signed(v, 3)} /></div>
      <div className="matchup-metric-row"><RankValue value={away.power?.fpi} rank={away.power?.fpiRank} format={signed} /><MetricLabel label="Power rating" detail={`ESPN FPI${fpiWeek != null ? ` · Week ${fpiWeek}` : ""}`} basis="model" /><RankValue value={home.power?.fpi} rank={home.power?.fpiRank} format={signed} /></div>
    </section>
    {sampleNotes.length > 0 && <p className="matchup-data-note"><strong>Sample note:</strong> {sampleNotes.join(" · ")}. Published values are shown, but early-season numbers can move quickly.</p>}
    <Comparison away={away} home={home} possession="away" />
    <Comparison away={away} home={home} possession="home" />
    <details className="matchup-guide">
      <summary>How to read these numbers</summary>
      <p>Ranks compare each unit with FBS offenses or defenses. Blue marks the better national rank; it is a comparison, not a predicted winner. The smaller number is the underlying stat. Defensive values describe what opponents gain.</p>
      <p><strong>Opponent-adjusted</strong> numbers account for schedule strength. <strong>Raw</strong> numbers are the team’s observed rate without an opponent adjustment. <strong>Predictive model</strong> identifies ESPN FPI rather than a directly observed stat.</p>
      <p>EPA measures how a play changes expected points. Success rate measures how often a play succeeds; explosive rate captures big plays. Line yards estimates the rushing contribution near the line of scrimmage. Third-down success measures performance on third downs.</p>
      <p>Weekly advanced data: SportsDataverse. Power rating: ESPN FPI. Only snapshots published for weeks before this matchup are used.</p>
    </details>
  </div>;
}

function FormTeam({ team, logo }: { team: MatchupTeam; logo?: string | null }) {
  const count = team.ats.wins + team.ats.losses + team.ats.pushes;
  return <section className="matchup-form-team">
    <div className="matchup-form-heading"><Logo src={logo} size={30} /><h3>{team.name}</h3></div>
    <div className="matchup-form-stats"><div><small>RECORD</small><strong>{team.resultsAvailable ? `${team.record.wins}–${team.record.losses}` : "—"}</strong></div><div><small>AVG. MARGIN</small><strong>{team.scoring.margin == null ? "—" : signed(team.scoring.margin)}</strong></div><div><small>ATS</small><strong>{count ? `${team.ats.wins}–${team.ats.losses}–${team.ats.pushes}` : "—"}</strong></div></div>
    <h4>Last five games</h4>
    {team.recent.length ? team.recent.slice(0, 5).map(row => <div className="matchup-result-row" key={row.id}><span className={row.result === "W" ? "matchup-result-win" : "matchup-result-loss"}>{row.result}</span><div><strong>{row.home ? "vs" : "at"} {teamDisplayName("CFB", row.opponent)}</strong><small>Week {row.week}</small></div><strong>{row.teamPoints}–{row.opponentPoints}</strong></div>) : <p className="matchup-empty-copy">No completed results available.</p>}
    <h4>Against the spread</h4>
    <p className="matchup-form-note">{count ? `${count} tracked games · Average cover margin ${signed(team.ats.avgCoverMargin!)}` : "No graded spreads available."}</p>
    {team.ats.recent.map(row => <div className="matchup-result-row" key={row.id}><span className={row.result === "W" ? "matchup-result-win" : row.result === "L" ? "matchup-result-loss" : "matchup-result-push"}>{row.result}</span><div><strong>{row.home ? "vs" : "at"} {teamDisplayName("CFB", row.opponent)} {spreadText(row.spread)}</strong><small>Week {row.week} · Cover margin {signed(row.coverMargin)}</small></div><strong>{row.teamPoints}–{row.opponentPoints}</strong></div>)}
  </section>;
}

function History({ history, away, home }: { history: MatchupHistory; away: string; home: string }) {
  const wins = history.games.filter(row => Number(row.teamPoints) > Number(row.opponentPoints)).length;
  const losses = history.games.filter(row => Number(row.teamPoints) < Number(row.opponentPoints)).length;
  return <div className="matchup-tab-body">
    <div className="matchup-section-heading"><span className="matchup-eyebrow">HEAD TO HEAD</span><h3>The last eight seasons</h3></div>
    {!history.complete && <p className="matchup-data-note">Some historical seasons are unavailable. The record below includes only the meetings we could verify.</p>}
    {history.games.length ? <><div className="matchup-series-summary"><span>{away}<strong>{wins}</strong></span><small>WINS</small><span>{home}<strong>{losses}</strong></span></div>{history.games.map(row => <div className="matchup-history-row" key={row.id}><span>{new Date(row.date).getUTCFullYear()}</span><div><strong>{away} {row.teamPoints} · {home} {row.opponentPoints}</strong><small>{row.venue || (row.neutralSite ? "Neutral site" : "Previous meeting")}</small></div></div>)}</> : <p className="matchup-empty-copy">{history.complete ? "No meetings in the last eight seasons." : "History is temporarily unavailable."}</p>}
  </div>;
}

export default function MatchupPreview({ game, onClose }: { game: Game; onClose: () => void }) {
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
  const away = teamDisplayName("CFB", game.away_team);
  const home = teamDisplayName("CFB", game.home_team);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    const priorFocus = document.activeElement as HTMLElement | null;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const backdrop = sheet.current?.parentElement;
    const siblings = Array.from(document.body.children).filter((node): node is HTMLElement => node instanceof HTMLElement && node !== backdrop);
    const inertStates = siblings.map(node => node.inert);
    siblings.forEach(node => { node.inert = true; });
    sheet.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close.current(); }
      if (event.key !== "Tab") return;
      const elements = Array.from(sheet.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], summary, [tabindex="0"]') || []).filter(node => node.getClientRects().length > 0);
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && (document.activeElement === first || !sheet.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = priorOverflow;
      siblings.forEach((node, index) => { node.inert = inertStates[index]; });
      priorFocus?.focus();
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
  const tabs: Array<[Tab, string]> = [["matchup", "Matchup"], ["form", "Form & ATS"], ["history", "History"]];
  return createPortal(<div className="matchup-preview-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={sheet} className="matchup-preview-sheet" role="dialog" aria-modal="true" aria-label={`${away} at ${home} matchup preview`}>
      <header className="matchup-preview-header"><span>MATCHUP PREVIEW</span><button className="matchup-preview-close" type="button" onClick={onClose} aria-label="Close matchup preview"><X size={20} /></button></header>
      <div className="matchup-preview-kickoff">{formatOrdinalDate(matchupDateFormatter, new Date(game.commence_time))} CT</div>
      <div className="matchup-preview-hero">
        {(["away", "home"] as const).map((side, index) => <div className="matchup-preview-team" key={side}><Logo src={side === "away" ? game.away_logo_url : game.home_logo_url} size={46} /><strong>{side === "away" ? away : home}</strong><span>{payload?.teams[side].resultsAvailable ? `${payload.teams[side].record.wins}–${payload.teams[side].record.losses}` : "—"}<b>{spreadText(normalizeSpreadForSelectedTeam(side === "away" ? game.away_team : game.home_team, game.current_spread_team, game.current_spread))}</b></span>{index === 0 && <small className="matchup-preview-at">AT</small>}</div>)}
      </div>
      <nav className="matchup-preview-tabs" aria-label="Matchup sections">{tabs.map(([id, label]) => <button type="button" key={id} aria-current={tab === id ? "page" : undefined} className={tab === id ? "active" : ""} onClick={() => { setTab(id); sheet.current?.querySelector(".matchup-preview-scroll")?.scrollTo(0, 0); }}>{label}</button>)}</nav>
      <div className="matchup-preview-scroll">
        {error && <div className="matchup-empty-copy" role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
        {!payload && !error && <div className="matchup-preview-loading" role="status"><LoaderCircle size={22} /><span>Getting the matchup ready…</span></div>}
        {payload && tab === "matchup" && <Matchup payload={payload} />}
        {payload && tab === "form" && <div className="matchup-tab-body"><p className="matchup-data-note">Results before this matchup. ATS uses this app’s tracked spreads, so its sample may be smaller than the season record.</p><div className="matchup-split-lists"><FormTeam team={payload.teams.away} logo={game.away_logo_url} /><FormTeam team={payload.teams.home} logo={game.home_logo_url} /></div></div>}
        {payload && tab === "history" && (history ? <History history={history} away={away} home={home} /> : historyError ? <div className="matchup-empty-copy" role="alert"><p>{historyError}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div> : <div className="matchup-preview-loading" role="status"><LoaderCircle size={22} /><span>Finding past meetings…</span></div>)}
      </div>
    </section>
  </div>, document.body);
}
