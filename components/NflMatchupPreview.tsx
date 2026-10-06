"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { LoaderCircle, X } from "lucide-react";
import type { Game } from "@/lib/types";
import type { NflMatchupHistory, NflMatchupPayload, NflMatchupTeam } from "@/lib/nflMatchup";
import { createAsyncCache } from "@/lib/asyncCache";
import { formatOrdinalDate, matchupDateFormatter } from "@/lib/displayDates";
import { normalizeSpreadForSelectedTeam, spreadText } from "@/lib/spreads";
import { teamDisplayName } from "@/lib/teamNames";

type Tab = "matchup" | "form" | "history";
type Snapshot = NonNullable<NflMatchupTeam["offense"]>;
const getPreview = createAsyncCache<NflMatchupPayload>(5 * 60_000, 24);
const getHistory = createAsyncCache<NflMatchupHistory>(15 * 60_000, 24);

const signed = (value: number, digits = 3) => `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

const metrics: Array<{
  label: string;
  value: keyof Snapshot;
  rank: keyof Snapshot;
  format: (value: number) => string;
}> = [
  { label: "EPA / play", value: "epaPerPlay", rank: "epaPerPlayRank", format: value => signed(value) },
  { label: "Pass EPA / dropback", value: "passEpaPerDropback", rank: "passEpaPerDropbackRank", format: value => signed(value) },
  { label: "Rush EPA / carry", value: "rushEpaPerCarry", rank: "rushEpaPerCarryRank", format: value => signed(value) },
  { label: "Yards / play", value: "yardsPerPlay", rank: "yardsPerPlayRank", format: value => value.toFixed(2) },
  { label: "Explosive 20+ rate", value: "explosiveRate", rank: "explosiveRateRank", format: pct },
  { label: "First-down rate", value: "firstDownRate", rank: "firstDownRateRank", format: pct },
  { label: "Turnover rate", value: "turnoverRate", rank: "turnoverRateRank", format: pct },
  { label: "Sack rate", value: "sackRate", rank: "sackRateRank", format: pct },
  { label: "Passing CPOE", value: "cpoe", rank: "cpoeRank", format: value => `${value > 0 ? "+" : ""}${value.toFixed(1)}` }
];

async function requestData<T>(gameId: string, section: string, token: string): Promise<T> {
  const response = await fetch(`/api/nfl-matchup-preview?gameId=${encodeURIComponent(gameId)}&section=${section}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
    signal: AbortSignal.timeout(25_000)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "NFL matchup data could not load.");
  return payload as T;
}

function Logo({ src, size = 40 }: { src?: string | null; size?: number }) {
  return src ? <Image unoptimized src={src} alt="" width={size} height={size} /> : <span className="matchup-logo-fallback" />;
}

function rankTone(rank?: number | null) {
  if (rank == null || !Number.isFinite(rank)) return "";
  if (rank <= 10) return " rank-good";
  if (rank <= 22) return " rank-average";
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

function Comparison({
  away,
  home,
  awayLogo,
  homeLogo,
  possession
}: {
  away: NflMatchupTeam;
  home: NflMatchupTeam;
  awayLogo?: string | null;
  homeLogo?: string | null;
  possession: "away" | "home";
}) {
  const left = possession === "away" ? away.offense : away.defense;
  const right = possession === "home" ? home.offense : home.defense;
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
      <RankValue value={left?.[metric.value] as number | null | undefined} rank={left?.[metric.rank] as number | null | undefined} format={metric.format} />
      <MetricLabel label={metric.label} />
      <RankValue value={right?.[metric.value] as number | null | undefined} rank={right?.[metric.rank] as number | null | undefined} format={metric.format} />
    </div>)}
  </section>;
}

function Analytics({ payload, awayLogo, homeLogo }: { payload: NflMatchupPayload; awayLogo?: string | null; homeLogo?: string | null }) {
  const { away, home } = payload.teams;
  const incomplete = !away.advancedAvailable || !home.advancedAvailable;
  return <div className="matchup-tab-body">
    <section className="matchup-strength">
      <div className="matchup-section-heading"><h3>Overall Strength</h3></div>
      <div className="matchup-column-heads matchup-strength-heads">
        <span className="matchup-strength-team matchup-strength-left"><Logo src={awayLogo} size={20} /><strong>{away.name}</strong></span>
        <span>STAT</span>
        <span className="matchup-strength-team matchup-strength-right"><strong>{home.name}</strong><Logo src={homeLogo} size={20} /></span>
      </div>
      <div className="matchup-metric-row">
        <RankValue value={away.overall.value} rank={away.overall.rank} format={value => signed(value)} />
        <MetricLabel label="Net EPA / play" />
        <RankValue value={home.overall.value} rank={home.overall.rank} format={value => signed(value)} />
      </div>
      <div className="matchup-metric-row">
        <RankValue value={away.offense?.epaPerPlay} rank={away.offense?.epaPerPlayRank} format={value => signed(value)} />
        <MetricLabel label="Offense EPA / play" />
        <RankValue value={home.offense?.epaPerPlay} rank={home.offense?.epaPerPlayRank} format={value => signed(value)} />
      </div>
      <div className="matchup-metric-row">
        <RankValue value={away.defense?.epaPerPlay} rank={away.defense?.epaPerPlayRank} format={value => signed(value)} />
        <MetricLabel label="EPA / play allowed" />
        <RankValue value={home.defense?.epaPerPlay} rank={home.defense?.epaPerPlayRank} format={value => signed(value)} />
      </div>
    </section>
    <p className="matchup-data-note">
      <strong>NFL advanced data:</strong> nflverse/nflfastR through Week {payload.throughWeek}. Ranks compare all available NFL teams.
      {incomplete ? " The current weekly release is still catching up for one or both teams." : ""}
    </p>
    <Comparison away={away} home={home} awayLogo={awayLogo} homeLogo={homeLogo} possession="away" />
    <Comparison away={away} home={home} awayLogo={awayLogo} homeLogo={homeLogo} possession="home" />
  </div>;
}

function FormTeam({ team, logo }: { team: NflMatchupTeam; logo?: string | null }) {
  const count = team.ats.wins + team.ats.losses + team.ats.pushes;
  return <section className="matchup-form-team">
    <div className="matchup-form-heading"><Logo src={logo} size={30} /><h3>{team.name}</h3></div>
    <div className="matchup-form-stats">
      <div><small>RECORD</small><strong>{team.resultsAvailable ? `${team.record.wins}–${team.record.losses}` : "—"}</strong></div>
      <div><small>AVG. MARGIN</small><strong>{team.scoring.margin == null ? "—" : signed(team.scoring.margin, 1)}</strong></div>
      <div><small>ATS</small><strong>{count ? `${team.ats.wins}–${team.ats.losses}–${team.ats.pushes}` : "—"}</strong></div>
      <div><small>AVG. COVER</small><strong>{team.ats.avgCoverMargin == null ? "—" : signed(team.ats.avgCoverMargin, 1)}</strong></div>
    </div>
    <h4>Season Results</h4>
    {team.recent.length ? team.recent.map(row => <div className="matchup-result-row" key={row.id}>
      <span className={row.result === "W" ? "matchup-result-win" : row.result === "L" ? "matchup-result-loss" : "matchup-result-push"}>{row.result}</span>
      <div><strong>{row.home ? "vs" : "at"} {teamDisplayName("NFL", row.opponent)}</strong><small>Week {row.week}</small></div>
      <strong>{row.teamPoints}–{row.opponentPoints}</strong>
    </div>) : <p className="matchup-empty-copy">No completed results available.</p>}
    <h4>Against the Spread</h4>
    {team.ats.recent.length ? team.ats.recent.map(row => <div className="matchup-result-row" key={row.id}>
      <span className={row.result === "W" ? "matchup-result-win" : row.result === "L" ? "matchup-result-loss" : "matchup-result-push"}>{row.result}</span>
      <div><strong>{row.home ? "vs" : "at"} {teamDisplayName("NFL", row.opponent)} {spreadText(row.spread)}</strong><small>Week {row.week} · Cover {signed(row.coverMargin, 1)}</small></div>
      <strong>{row.teamPoints}–{row.opponentPoints}</strong>
    </div>) : <p className="matchup-empty-copy">No graded spreads.</p>}
  </section>;
}

function History({ history, away, home }: { history: NflMatchupHistory; away: string; home: string }) {
  const wins = history.games.filter(row => Number(row.teamPoints) > Number(row.opponentPoints)).length;
  const losses = history.games.filter(row => Number(row.teamPoints) < Number(row.opponentPoints)).length;
  return <div className="matchup-tab-body">
    <div className="matchup-section-heading"><h3>Head-to-head · 8 seasons</h3></div>
    {!history.complete && <p className="matchup-data-note">Some seasons are unavailable; showing verified meetings.</p>}
    {history.games.length ? <>
      <div className="matchup-series-summary"><span>{away}<strong>{wins}</strong></span><small>WINS</small><span>{home}<strong>{losses}</strong></span></div>
      {history.games.map(row => <div className="matchup-history-row" key={row.id}>
        <span>{new Date(row.date).getUTCFullYear()}</span>
        <div><strong>{away} {row.teamPoints} · {home} {row.opponentPoints}</strong><small>{row.venue || (row.neutralSite ? "Neutral site" : "Previous meeting")}</small></div>
      </div>)}
    </> : <p className="matchup-empty-copy">{history.complete ? "No meetings in the last eight seasons." : "History is temporarily unavailable."}</p>}
  </div>;
}

export default function NflMatchupPreview({ game, onClose }: { game: Game; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("matchup");
  const [payload, setPayload] = useState<NflMatchupPayload | null>(null);
  const [history, setHistory] = useState<NflMatchupHistory | null>(null);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [retry, setRetry] = useState(0);
  const [mounted, setMounted] = useState(false);
  const sheet = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const away = teamDisplayName("NFL", game.away_team);
  const home = teamDisplayName("NFL", game.home_team);

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
    setPayload(null);
    setHistory(null);
    setError("");
    setHistoryError("");
    setTab("matchup");
    const token = window.localStorage.getItem("pickem_session_token") || "";
    void getPreview(`${token}:${game.id}`, () => requestData<NflMatchupPayload>(game.id, "matchup", token))
      .then(data => { if (active) setPayload(data); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Could not load NFL matchup."); });
    return () => { active = false; };
  }, [game.id, retry]);

  useEffect(() => {
    if (tab !== "history" || history) return;
    let active = true;
    setHistoryError("");
    const token = window.localStorage.getItem("pickem_session_token") || "";
    void getHistory(`${token}:${game.id}`, () => requestData<NflMatchupHistory>(game.id, "history", token))
      .then(data => { if (active) setHistory(data); })
      .catch(cause => { if (active) setHistoryError(cause instanceof Error ? cause.message : "Could not load NFL history."); });
    return () => { active = false; };
  }, [tab, game.id, history, retry]);

  if (!mounted) return null;
  const tabs: Array<[Tab, string]> = [["matchup", "Analytics"], ["form", "Form"], ["history", "History"]];

  return createPortal(<div className="matchup-preview-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={sheet} className="matchup-preview-sheet" role="dialog" aria-modal="true" aria-label={`${away} at ${home} NFL matchup preview`}>
      <header className="matchup-preview-header"><span>{away} at {home}</span><button className="matchup-preview-close" type="button" onClick={onClose} aria-label="Close matchup preview"><X size={18} /></button></header>
      <div className="matchup-preview-kickoff">{formatOrdinalDate(matchupDateFormatter, new Date(game.commence_time))} CT</div>
      <div className="matchup-preview-hero">
        {(["away", "home"] as const).map((side, index) => <div className="matchup-preview-team" key={side}>
          <Logo src={side === "away" ? game.away_logo_url : game.home_logo_url} size={46} />
          <strong>{side === "away" ? away : home}</strong>
          <span>{payload?.teams[side].resultsAvailable ? `${payload.teams[side].record.wins}–${payload.teams[side].record.losses}` : "—"}<b>{spreadText(normalizeSpreadForSelectedTeam(side === "away" ? game.away_team : game.home_team, game.current_spread_team, game.current_spread))}</b></span>
          {index === 0 && <small className="matchup-preview-at">AT</small>}
        </div>)}
      </div>
      <nav className="matchup-preview-tabs" aria-label="NFL matchup sections">{tabs.map(([id, label]) => <button type="button" key={id} aria-current={tab === id ? "page" : undefined} className={tab === id ? "active" : ""} onClick={() => { setTab(id); sheet.current?.querySelector(".matchup-preview-scroll")?.scrollTo(0, 0); }}>{label}</button>)}</nav>
      <div className="matchup-preview-scroll">
        {error && <div className="matchup-empty-copy" role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
        {!payload && !error && <div className="matchup-preview-loading" role="status"><LoaderCircle size={22} /><span>Loading NFL matchup…</span></div>}
        {payload && tab === "matchup" && <Analytics payload={payload} awayLogo={game.away_logo_url} homeLogo={game.home_logo_url} />}
        {payload && tab === "form" && <div className="matchup-tab-body"><div className="matchup-split-lists"><FormTeam team={payload.teams.away} logo={game.away_logo_url} /><FormTeam team={payload.teams.home} logo={game.home_logo_url} /></div></div>}
        {payload && tab === "history" && (history ? <History history={history} away={away} home={home} /> : historyError ? <div className="matchup-empty-copy" role="alert"><p>{historyError}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div> : <div className="matchup-preview-loading" role="status"><LoaderCircle size={22} /><span>Loading history…</span></div>)}
      </div>
    </section>
  </div>, document.body);
}
