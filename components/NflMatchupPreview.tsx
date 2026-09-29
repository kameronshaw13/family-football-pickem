"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { LoaderCircle, X } from "lucide-react";
import type { Game } from "@/lib/types";
import type { NflMatchupPayload, NflMatchupTeam } from "@/lib/nflMatchup";
import { createAsyncCache } from "@/lib/asyncCache";
import { formatOrdinalDate, matchupDateFormatter } from "@/lib/displayDates";
import { normalizeSpreadForSelectedTeam, spreadText } from "@/lib/spreads";
import { teamDisplayName } from "@/lib/teamNames";

type Tab = "analytics" | "form" | "stats";
type MetricUnit = NonNullable<NonNullable<NflMatchupTeam["relative"]>["offense"]>;
const getPreview = createAsyncCache<NflMatchupPayload>(5 * 60_000, 24);

const signed = (value: number, digits = 2) => `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
const pct = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;

const metrics: Array<{
  label: string;
  value: keyof MetricUnit;
  rank: keyof MetricUnit;
  format: (value: number) => string;
}> = [
  { label: "EPA / play", value: "epaPerPlay", rank: "epaPerPlayRank", format: value => signed(value, 3) },
  { label: "Pass EPA / dropback", value: "passEpaPerDropback", rank: "passEpaPerDropbackRank", format: value => signed(value, 3) },
  { label: "Rush EPA / carry", value: "rushEpaPerCarry", rank: "rushEpaPerCarryRank", format: value => signed(value, 3) },
  { label: "CPOE", value: "cpoe", rank: "cpoeRank", format: value => `${signed(value, 1)}%` },
  { label: "Explosive rate", value: "explosiveRate", rank: "explosiveRateRank", format: value => pct(value) },
  { label: "Yards / play", value: "yardsPerPlay", rank: "yardsPerPlayRank", format: value => value.toFixed(2) },
  { label: "First-down rate", value: "firstDownRate", rank: "firstDownRateRank", format: value => pct(value) },
  { label: "Turnover rate", value: "turnoverRate", rank: "turnoverRateRank", format: value => pct(value) }
];

async function requestData(gameId: string, token: string): Promise<NflMatchupPayload> {
  const response = await fetch(`/api/nfl-matchup-preview?gameId=${encodeURIComponent(gameId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
    signal: AbortSignal.timeout(25_000)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "NFL matchup data could not load.");
  return payload as NflMatchupPayload;
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
      <RankValue value={left?.[metric.value] as number | null | undefined} rank={left?.[metric.rank] as number | null | undefined} format={metric.format} />
      <MetricLabel label={metric.label} />
      <RankValue value={right?.[metric.value] as number | null | undefined} rank={right?.[metric.rank] as number | null | undefined} format={metric.format} />
    </div>)}
  </section>;
}

function Analytics({ payload, awayLogo, homeLogo }: { payload: NflMatchupPayload; awayLogo?: string | null; homeLogo?: string | null }) {
  const { away, home } = payload.teams;
  return <div className="matchup-tab-body">
    <div className="matchup-section-heading"><h3>Advanced Efficiency</h3></div>
    {!payload.advancedAvailable && <p className="matchup-data-note"><strong>Advanced snapshot pending:</strong> records and form are current while the nflverse team summary refreshes.</p>}
    {payload.advancedAvailable && <p className="matchup-data-note"><strong>nflverse / nflfastR:</strong> team efficiency through Week {payload.throughWeek}. Rank is among NFL teams with data.</p>}
    <Comparison away={away} home={home} awayLogo={awayLogo} homeLogo={homeLogo} possession="away" />
    <Comparison away={away} home={home} awayLogo={awayLogo} homeLogo={homeLogo} possession="home" />
  </div>;
}

function recordText(record: NflMatchupTeam["record"]) {
  return record.ties ? `${record.wins}–${record.losses}–${record.ties}` : `${record.wins}–${record.losses}`;
}

function FormTeam({ team, logo }: { team: NflMatchupTeam; logo?: string | null }) {
  const atsCount = team.ats.wins + team.ats.losses + team.ats.pushes;
  return <section className="matchup-form-team">
    <div className="matchup-form-heading"><Logo src={logo} size={30} /><h3>{team.name}</h3></div>
    <div className="matchup-form-stats">
      <div><small>RECORD</small><strong>{team.resultsAvailable ? recordText(team.record) : "—"}</strong></div>
      <div><small>AVG. MARGIN</small><strong>{team.scoring.margin == null ? "—" : signed(team.scoring.margin, 1)}</strong></div>
      <div><small>ATS</small><strong>{atsCount ? `${team.ats.wins}–${team.ats.losses}–${team.ats.pushes}` : "—"}</strong></div>
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

function StatValue({ value, digits = 1 }: { value: number | null | undefined; digits?: number }) {
  return <strong>{value == null || !Number.isFinite(value) ? "—" : value.toFixed(digits)}</strong>;
}

function TeamStats({ payload, awayLogo, homeLogo }: { payload: NflMatchupPayload; awayLogo?: string | null; homeLogo?: string | null }) {
  const { away, home } = payload.teams;
  const row = (label: string, awayValue: number | null | undefined, homeValue: number | null | undefined, digits = 1) =>
    <div className="matchup-metric-row" key={label}><StatValue value={awayValue} digits={digits} /><MetricLabel label={label} /><StatValue value={homeValue} digits={digits} /></div>;

  return <div className="matchup-tab-body">
    <section className="matchup-comparison-block">
      <div className="matchup-column-heads">
        <span className="matchup-strength-team matchup-strength-left"><Logo src={awayLogo} size={20} /><strong>{away.name}</strong></span>
        <span>TEAM STATS</span>
        <span className="matchup-strength-team matchup-strength-right"><strong>{home.name}</strong><Logo src={homeLogo} size={20} /></span>
      </div>
      {row("Points / game", away.scoring.ppg, home.scoring.ppg)}
      {row("Points allowed", away.scoring.allowedPpg, home.scoring.allowedPpg)}
      {row("Yards / game", away.regular.yardsPerGame, home.regular.yardsPerGame)}
      {row("Pass yards / game", away.regular.passYardsPerGame, home.regular.passYardsPerGame)}
      {row("Rush yards / game", away.regular.rushYardsPerGame, home.regular.rushYardsPerGame)}
      {row("Turnovers / game", away.regular.turnoversPerGame, home.regular.turnoversPerGame, 2)}
    </section>
  </div>;
}

export default function NflMatchupPreview({ game, onClose }: { game: Game; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("analytics");
  const [payload, setPayload] = useState<NflMatchupPayload | null>(null);
  const [error, setError] = useState("");
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
    setError("");
    setTab("analytics");
    const token = window.localStorage.getItem("pickem_session_token") || "";
    void getPreview(`${token}:${game.id}`, () => requestData(game.id, token))
      .then(data => { if (active) setPayload(data); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Could not load NFL matchup."); });
    return () => { active = false; };
  }, [game.id, retry]);

  if (!mounted) return null;
  const tabs: Array<[Tab, string]> = [["analytics", "Analytics"], ["form", "Form"], ["stats", "Stats"]];

  return createPortal(<div className="matchup-preview-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={sheet} className="matchup-preview-sheet" role="dialog" aria-modal="true" aria-label={`${away} at ${home} NFL matchup preview`}>
      <header className="matchup-preview-header"><span>NFL MATCHUP PREVIEW</span><button className="matchup-preview-close" type="button" onClick={onClose} aria-label="Close matchup preview"><X size={20} /></button></header>
      <div className="matchup-preview-kickoff">{formatOrdinalDate(matchupDateFormatter, new Date(game.commence_time))} CT</div>
      <div className="matchup-preview-hero">
        {(["away", "home"] as const).map((side, index) => <div className="matchup-preview-team" key={side}>
          <Logo src={side === "away" ? game.away_logo_url : game.home_logo_url} size={46} />
          <strong>{side === "away" ? away : home}</strong>
          <span>
            {payload?.teams[side].resultsAvailable ? recordText(payload.teams[side].record) : "—"}
            <b>{spreadText(normalizeSpreadForSelectedTeam(side === "away" ? game.away_team : game.home_team, game.current_spread_team, game.current_spread))}</b>
          </span>
          {index === 0 && <small className="matchup-preview-at">AT</small>}
        </div>)}
      </div>
      <nav className="matchup-preview-tabs" aria-label="NFL matchup sections">
        {tabs.map(([id, label]) => <button type="button" key={id} aria-current={tab === id ? "page" : undefined} className={tab === id ? "active" : ""} onClick={() => { setTab(id); sheet.current?.querySelector(".matchup-preview-scroll")?.scrollTo(0, 0); }}>{label}</button>)}
      </nav>
      <div className="matchup-preview-scroll">
        {error && <div className="matchup-empty-copy" role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
        {!payload && !error && <div className="matchup-preview-loading" role="status"><LoaderCircle size={22} /><span>Loading NFL matchup…</span></div>}
        {payload && tab === "analytics" && <Analytics payload={payload} awayLogo={game.away_logo_url} homeLogo={game.home_logo_url} />}
        {payload && tab === "form" && <div className="matchup-tab-body"><div className="matchup-split-lists"><FormTeam team={payload.teams.away} logo={game.away_logo_url} /><FormTeam team={payload.teams.home} logo={game.home_logo_url} /></div></div>}
        {payload && tab === "stats" && <TeamStats payload={payload} awayLogo={game.away_logo_url} homeLogo={game.home_logo_url} />}
      </div>
    </section>
  </div>, document.body);
}
