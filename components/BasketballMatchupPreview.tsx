"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { LoaderCircle } from "lucide-react";
import type { Game } from "@/lib/types";
import type { BasketballForm, BasketballResult } from "@/lib/basketballPreviewData";
import { getClientSessionToken } from "@/lib/clientSession";
import { teamDisplayName } from "@/lib/teamNames";
import { normalizeSpreadForSelectedTeam, spreadText } from "@/lib/spreads";
import useGameSheetDismiss from "@/hooks/useGameSheetDismiss";
import GameDetailClose from "@/components/GameDetailClose";
import MatchupTipoff from "@/components/MatchupTipoff";
import MatchupResultMark from "@/components/MatchupResultMark";
import CollegeBasketballAnalytics from "@/components/CollegeBasketballAnalytics";
import LineMovement from "@/components/LineMovement";

type Tab = "analytics" | "form" | "history" | "movement";
type Payload = { year: number; complete: boolean; teams: { away: BasketballForm; home: BasketballForm } };
type HistoryPayload = { games: BasketballResult[]; complete: boolean; firstSeason: number; lastSeason: number };
const formDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" });
const historyDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" });
const signed = (value: number | null) => value == null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
function Logo({ src, name, size }: { src: string | null; name: string; size: number }) {
  return src ? <Image unoptimized src={src} alt="" width={size} height={size} /> : <span className="matchup-logo-fallback" aria-label={name}>{name.slice(0, 1)}</span>;
}
function Loading() { return <div className="matchup-preview-loading" role="status"><LoaderCircle size={22} /><span>Loading matchup…</span></div>; }
function Failure({ error, retry }: { error: string; retry: () => void }) { return <div className="matchup-empty-copy" role="alert"><p>{error}</p><button type="button" onClick={retry}>Try again</button></div>; }

function FormTeam({ team, league }: { team: BasketballForm; league: string }) {
  const name = teamDisplayName(league, team.name);
  const atsCount = team.ats.wins + team.ats.losses + team.ats.pushes;
  return <section className="matchup-form-team">
    <div className="matchup-form-heading"><Logo src={team.logo} name={name} size={42} /><h3>{name}</h3></div>
    <div className="matchup-form-stats">
      <div><small>RECORD</small><strong>{team.games.length ? `${team.record.wins}-${team.record.losses}` : "—"}</strong></div>
      <div><small>AVG. MARGIN</small><strong>{signed(team.margin)}</strong></div>
      <div><small>ATS</small><strong>{atsCount ? `${team.ats.wins}-${team.ats.losses}-${team.ats.pushes}` : "—"}</strong></div>
      <div><small>AVG. COVER</small><strong>{signed(team.ats.margin)}</strong></div>
    </div>
    <h4>Season Games</h4>
    {team.games.length ? team.games.map(row => <div className="matchup-result-row matchup-form-combined-row" key={row.id}>
      <MatchupResultMark result={row.result} />
      <div className="matchup-result-opponent"><strong>{row.neutralSite ? "vs" : row.home ? "vs" : "at"} {teamDisplayName(league, row.opponent)}</strong><small><span>{formDate.format(new Date(row.date))}</span><span className="matchup-form-spread"><span className="ui-separator-dot matchup-form-week-dot" aria-hidden="true">·</span>Spread {spreadText(row.spread)}</span></small></div>
      <div className="matchup-result-outcome"><strong>{row.teamPoints}-{row.opponentPoints}</strong>{row.ats && <small>ATS <b className={row.ats === "W" ? "matchup-cover-win" : row.ats === "L" ? "matchup-cover-loss" : "matchup-cover-push"}>{row.ats}</b></small>}</div>
    </div>) : <p className="matchup-empty-copy">No completed games this season before this matchup.</p>}
    {team.games.length > atsCount && <p className="matchup-data-note">ATS includes only games with a saved spread.</p>}
  </section>;
}

function History({ data, game }: { data: HistoryPayload; game: Game }) {
  const away = teamDisplayName(game.league, game.away_team), home = teamDisplayName(game.league, game.home_team);
  const wins = data.games.filter(row => row.result === "W").length, losses = data.games.filter(row => row.result === "L").length;
  return <div className="matchup-tab-body matchup-history-body">
    <div className="matchup-section-heading"><h3>Head-to-head</h3></div>
    <p className="matchup-data-note">{data.complete ? "Available meetings" : "Some season schedules are unavailable"} · {data.firstSeason - 1}–{data.lastSeason}</p>
    {data.games.length ? <>
      <div className="matchup-series-summary">
        <div className="matchup-series-side"><Logo src={game.away_logo_url} name={away} size={36} /><strong>{away}</strong><span className="matchup-series-wins"><b>{wins}</b> {wins === 1 ? "win" : "wins"}</span></div>
        <div className="matchup-series-center"><small>LAST</small><strong>{data.games.length}</strong><small>MEETINGS</small></div>
        <div className="matchup-series-side"><Logo src={game.home_logo_url} name={home} size={36} /><strong>{home}</strong><span className="matchup-series-wins"><b>{losses}</b> {losses === 1 ? "win" : "wins"}</span></div>
      </div>
      <div className="matchup-history-list">{data.games.map(row => {
        const visitor = { name: row.home ? home : away, logo: row.home ? game.home_logo_url : game.away_logo_url, score: row.home ? row.opponentPoints : row.teamPoints };
        const host = { name: row.home ? away : home, logo: row.home ? game.away_logo_url : game.home_logo_url, score: row.home ? row.teamPoints : row.opponentPoints };
        return <article className="matchup-history-game" key={row.id}>
          <div className="matchup-history-game-meta"><time dateTime={row.date}>{historyDate.format(new Date(row.date))}</time></div>
          <div className="matchup-history-scoreboard">{[visitor, host].map((team, i) => <div key={i} className={`matchup-history-score-team ${team.score > (i ? visitor.score : host.score) ? "winner" : ""}`}><Logo src={team.logo} name={team.name} size={24} /><span>{team.name}</span><small>{row.neutralSite ? "NEUTRAL" : i ? "HOME" : "AWAY"}</small><strong>{team.score}</strong></div>)}</div>
        </article>;
      })}</div>
    </> : <p className="matchup-empty-copy">No completed meetings found in the available seasons.</p>}
  </div>;
}

export default function BasketballMatchupPreview({ game, onClose }: { game: Game; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>("analytics");
  const [payload, setPayload] = useState<Payload | null>(null), [history, setHistory] = useState<HistoryPayload | null>(null);
  const [error, setError] = useState(""), [historyError, setHistoryError] = useState("");
  const [retry, setRetry] = useState(0), [historyRetry, setHistoryRetry] = useState(0);
  const sheet = useRef<HTMLElement | null>(null), scroll = useRef<HTMLDivElement | null>(null);
  const close = useGameSheetDismiss(sheet, mounted, onClose);
  useEffect(() => {
    setMounted(true);
    const focus = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let navigated = false;
    const navigate = (event: MouseEvent) => { if (event.target instanceof Element && event.target.closest(".primary-nav button")) { navigated = true; onClose(); } };
    const keyboard = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } };
    document.addEventListener("click", navigate, true); document.addEventListener("keydown", keyboard);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("click", navigate, true); document.removeEventListener("keydown", keyboard); if (!navigated) focus?.focus(); };
  }, [onClose]);
  useEffect(() => { if (mounted) sheet.current?.querySelector<HTMLButtonElement>("button")?.focus(); }, [mounted]);
  useEffect(() => { setHistory(null); setHistoryError(""); setTab("analytics"); }, [game.id]);
  useEffect(() => {
    const controller = new AbortController();
    setPayload(null); setError("");
    fetch(`/api/basketball-preview?gameId=${encodeURIComponent(game.id)}`, { headers: { Authorization: `Bearer ${getClientSessionToken()}`, "x-pickem-group": "friends-basketball" }, cache: "no-store", signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not load matchup."); return data as Payload; })
      .then(data => { if (!controller.signal.aborted) setPayload(data); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load matchup."); });
    return () => controller.abort();
  }, [game.id, retry]);
  useEffect(() => {
    if (tab !== "history" || history) return;
    const controller = new AbortController(); setHistoryError("");
    fetch(`/api/basketball-preview?gameId=${encodeURIComponent(game.id)}&view=history`, { headers: { Authorization: `Bearer ${getClientSessionToken()}`, "x-pickem-group": "friends-basketball" }, cache: "no-store", signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not load history."); return data as HistoryPayload; })
      .then(data => { if (!controller.signal.aborted) setHistory(data); })
      .catch(reason => { if (!controller.signal.aborted) setHistoryError(reason instanceof Error ? reason.message : "Could not load history."); });
    return () => controller.abort();
  }, [game.id, tab, history, historyRetry]);
  if (!mounted) return null;
  const away = teamDisplayName(game.league, game.away_team), home = teamDisplayName(game.league, game.home_team);
  const tabs: [Tab, string][] = [["analytics", "Analytics"], ["form", "Form"], ["history", "History"], ["movement", "Line Movement"]];
  return createPortal(<div className="matchup-preview-backdrop" onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <section ref={sheet} className="matchup-preview-sheet basketball-matchup-preview" role="dialog" aria-modal="false" aria-label={`${away} at ${home} matchup preview`}>
      <header className="matchup-preview-header"><div className="matchup-detail-title"><strong>{away} at {home}</strong></div><GameDetailClose onClose={close} label="Close matchup preview" /></header>
      <div className="matchup-preview-hero"><MatchupTipoff commenceTime={game.commence_time} />{(["away", "home"] as const).map(side => {
        const name = side === "away" ? away : home, team = payload?.teams[side];
        const rank = game.league === "CBB" ? game[`${side}_rank`] : null;
        const spread = normalizeSpreadForSelectedTeam(game[`${side}_team`], game.current_spread_team, game.current_spread);
        return <div className="matchup-preview-team" key={side}><Logo src={game[`${side}_logo_url`]} name={name} size={46} /><strong>{rank != null && <small className="matchup-team-rank">#{rank} </small>}{name}</strong><span>{team?.games.length ? `${team.record.wins}-${team.record.losses}` : "—"}{spread != null && <b>{spreadText(spread)}</b>}</span></div>;
      })}<span className="matchup-center-at" aria-hidden="true">AT</span></div>
      <nav className="matchup-preview-tabs has-line-movement" aria-label="Basketball matchup sections">{tabs.map(([id, label]) => <button type="button" key={id} className={tab === id ? "active" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => { setTab(id); scroll.current?.scrollTo(0, 0); }}>{label}</button>)}</nav>
      <div className="matchup-preview-scroll" ref={scroll}>
        {tab === "movement" && <LineMovement game={game} />}
        {tab === "analytics" && game.league === "CBB" && <CollegeBasketballAnalytics gameId={game.id} />}
        {(tab === "form" || (tab === "analytics" && game.league === "NBA")) && (error ? <Failure error={error} retry={() => setRetry(value => value + 1)} /> : !payload ? <Loading /> : tab === "form" ? <div className="matchup-tab-body"><div className="matchup-split-lists"><FormTeam team={payload.teams.away} league={game.league} /><FormTeam team={payload.teams.home} league={game.league} /></div>{!payload.complete && <p className="matchup-data-note">Some season results are temporarily unavailable.</p>}</div> : <div className="matchup-tab-body">
          <div className="matchup-section-heading"><h3>Season Comparison</h3></div>
          <table className="basketball-stats"><thead><tr><th scope="col">{away}</th><th scope="col">Per Game</th><th scope="col">{home}</th></tr></thead><tbody>{([["Points", "points"], ["Points Allowed", "allowed"], ["Scoring Margin", "margin"]] as const).map(([label, key]) => <tr key={key}><td>{key === "margin" ? signed(payload.teams.away[key]) : payload.teams.away[key]?.toFixed(1) ?? "—"}</td><th scope="row">{label}</th><td>{key === "margin" ? signed(payload.teams.home[key]) : payload.teams.home[key]?.toFixed(1) ?? "—"}</td></tr>)}</tbody></table>
          <p className="matchup-data-note">Completed {payload.year - 1}–{payload.year} season games before this matchup.</p>
        </div>)}
        {tab === "history" && (history ? <History data={history} game={game} /> : historyError ? <Failure error={historyError} retry={() => setHistoryRetry(value => value + 1)} /> : <Loading />)}
      </div>
    </section>
  </div>, document.body);
}
