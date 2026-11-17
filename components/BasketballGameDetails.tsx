"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { LoaderCircle } from "lucide-react";
import GameDetailClose from "@/components/GameDetailClose";
import BasketballShotChart from "@/components/BasketballShotChart";
import BasketballLiveCourt, { BasketballScoreFlow } from "@/components/BasketballLiveCourt";
import type { Game } from "@/lib/types";
import { getClientSessionToken } from "@/lib/clientSession";
import useGameSheetDismiss from "@/hooks/useGameSheetDismiss";
import { teamDisplayName, teamAbbreviatedName } from "@/lib/teamNames";
import { playTextWithoutDuplicateClock } from "@/lib/playText";
import { basketballPeriodLabel, type BasketballShot } from "@/lib/basketballShots";
import { scoreFromCompetitor } from "@/lib/espnSchedule";
import { trackerDisplayScore } from "@/lib/trackerDisplayScore";

type Play = { id: string; text: string; period: number; clock: string; scoring: boolean; side?: Side | null; awayScore: number | null; homeScore: number | null };
type Team = { score?: string; records?: { summary: string; type?: string }[]; timeoutsRemaining?: number | string | null; fouls?: number | null; team?: { id?: string; displayName?: string; logo?: string; color?: string } };
type Payload = {
  status: { state?: string; shortDetail?: string; detail?: string; completed?: boolean; period?: number; clock?: string };
  teams: { away?: Team; home?: Team };
  stats: { label: string; away: string; home: string }[];
  players: { id: string; side: "away" | "home"; name: string; groups: { labels: string[]; athletes: { id: string; name: string; stats: string[] }[] }[] }[];
  plays: Play[]; shots: BasketballShot[]; shotAttempts: number;
  winProbability?: { id: string; home: number; progress: number }[];
  liveState?: { possessionSide: Side | null; latestAction: { id: string; text: string; side: Side | null; period: number; clock: string } | null };
};
type Tab = "live" | "scoring" | "plays" | "box";
type Side = "away" | "home";

function shortPlayerName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 && !/^[A-Z]\.$/.test(parts[0]) ? `${parts[0][0]}. ${parts.slice(1).join(" ")}` : name;
}

function BasketballLineScore({ plays, college, names, logos, finalScores }: {
  plays: Play[]; college: boolean; names: Record<Side, string>;
  logos: Record<Side, string | null | undefined>; finalScores: Record<Side, number | null>;
}) {
  const count = Math.max(college ? 2 : 4, ...plays.map(play => play.period));
  const periods = Array.from({ length: Math.min(count, 12) }, (_, index) => index + 1);
  const totals = periods.map(period => {
    const periodPlays = plays.filter(play => play.period === period && play.awayScore != null && play.homeScore != null);
    const last = periodPlays[periodPlays.length - 1];
    return last ? { away: last.awayScore, home: last.homeScore } : null;
  });
  const scoreFor = (side: Side, index: number) => {
    const now = totals[index]?.[side];
    const previous = index === 0 ? 0 : totals[index - 1]?.[side];
    return now == null || previous == null ? "—" : now - previous;
  };
  return <div className="basketball-linescore-scroll" role="region" aria-label="Scores by period" tabIndex={0}>
    <table className="basketball-linescore">
      <thead><tr><th scope="col" aria-label="Team"></th>{periods.map(period => <th scope="col" key={period}>{college ? (period > 2 ? `${period - 2}OT` : period) : (period > 4 ? `${period - 4}OT` : period)}</th>)}<th scope="col">T</th></tr></thead>
      <tbody>{(["away", "home"] as const).map(side => <tr key={side}><th scope="row">{logos[side] && <Image unoptimized src={logos[side]!} alt="" width={23} height={23} />}<span>{names[side]}</span></th>{periods.map((period, index) => <td key={period}>{scoreFor(side, index)}</td>)}<td className="basketball-linescore-total">{finalScores[side] ?? "—"}</td></tr>)}</tbody>
    </table>
  </div>;
}

export default function BasketballGameDetails({ game, onClose }: { game: Game; onClose: () => void }) {
  const [payload, setPayload] = useState<Payload | null>(null), [error, setError] = useState("");
  const signature = useRef("");
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>(game.live_completed || (game.final_away_score != null && game.final_home_score != null) ? "scoring" : "live");
  const [boxTeam, setBoxTeam] = useState<"all" | Side>("all");
  const [retry, setRetry] = useState(0);
  const sheet = useRef<HTMLElement | null>(null), scrollArea = useRef<HTMLDivElement | null>(null);
  const close = useGameSheetDismiss(sheet, mounted, onClose);
  useEffect(() => {
    setMounted(true);
    const priorFocus = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let switchedDestination = false;
    const navigate = (event: MouseEvent) => { if (event.target instanceof Element && event.target.closest(".primary-nav button")) { switchedDestination = true; onClose(); } };
    const keyboard = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } };
    document.addEventListener("click", navigate, true); document.addEventListener("keydown", keyboard);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("click", navigate, true); document.removeEventListener("keydown", keyboard); if (!switchedDestination) priorFocus?.focus(); };
  }, [onClose]);
  useEffect(() => { if (mounted) sheet.current?.querySelector<HTMLButtonElement>("button")?.focus(); }, [mounted]);
  useEffect(() => {
    setPayload(null); signature.current = ""; setError("");
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function load() {
      let complete = false;
      try {
        const response = await fetch(`/api/basketball-game?gameId=${encodeURIComponent(game.id)}`, {
          headers: { Authorization: `Bearer ${getClientSessionToken()}`, "x-pickem-group": "friends-basketball" }, cache: "no-store", signal: controller.signal
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load this game.");
        complete = Boolean(data.status?.completed);
        if (!cancelled) {
          const next = JSON.stringify(data);
          if (signature.current !== next) { signature.current = next; setPayload(data); }
          setError("");
        }
      } catch (failure) { if (!cancelled) setError(failure instanceof Error ? failure.message : "Could not load game."); }
      if (!cancelled && !complete) timer = setTimeout(load, 3000);
    }
    void load();
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [game.id, retry]);
  useEffect(() => { setTab(game.live_completed || (game.final_away_score != null && game.final_home_score != null) ? "scoring" : "live"); setBoxTeam("all"); }, [game.id, game.live_completed, game.final_away_score, game.final_home_score]);

  if (!mounted) return null;
  const completed = Boolean(payload?.status.completed || game.live_completed || (game.final_away_score != null && game.final_home_score != null));
  const pregame = !completed && (payload?.status.state || game.live_state || "pre") === "pre";
  const names = { away: teamDisplayName(game.league, game.away_team), home: teamDisplayName(game.league, game.home_team) };
  const logos = { away: game.away_logo_url, home: game.home_logo_url };
  const basketballPeriod = (period: number) => basketballPeriodLabel(period, game.league === "CBB").replace(/Half|Quarter/gi, "").trim();
  const timeoutCount = (side: Side) => { const count = Number(payload?.teams[side]?.timeoutsRemaining); return payload?.teams[side]?.timeoutsRemaining == null || !Number.isFinite(count) ? null : Math.max(0, Math.trunc(count)); };
  const foulsCount = (side: Side) => payload?.teams[side]?.fouls;
  const scoreChanged = (play: Play, previous?: Play) => Boolean(play.scoring && (previous == null || play.awayScore !== previous.awayScore || play.homeScore !== previous.homeScore));
  const scores = Object.fromEntries((["away", "home"] as const).map(side => [side, pregame ? null : trackerDisplayScore(completed, game.live_state === "in", game[`final_${side}_score`], game[`live_${side}_score`], scoreFromCompetitor(payload?.teams[side]), null)])) as Record<Side, number | null>;
  const plays = (payload?.plays || []).filter(play => tab !== "scoring" || play.scoring);
  const sortedPlays = completed ? plays : [...plays].reverse();
  const periodGroups = sortedPlays.reduce<{ period: number; plays: Play[] }[]>((groups, play) => {
    const latest = groups[groups.length - 1];
    if (!latest || latest.period !== play.period) groups.push({ period: play.period, plays: [play] });
    else latest.plays.push(play);
    return groups;
  }, []);
  const tabs: [Tab, string][] = [...(!completed ? [["live", "Live"] as [Tab, string]] : []), ["scoring", "Scoring"], ["plays", "Plays"], ["box", "Box Score"]];
  const teamStats = payload && <section className="game-tracker-team-stats" aria-label="Team statistics comparison">{payload.stats.map(row => <div className="game-tracker-stat-row" key={row.label}><strong aria-label={`${names.away} ${row.label}: ${row.away}`}>{row.away}</strong><span>{row.label}</span><strong aria-label={`${names.home} ${row.label}: ${row.home}`}>{row.home}</strong></div>)}</section>;

  return createPortal(<div className="game-tracker-backdrop" onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <section ref={sheet} className="game-tracker-sheet basketball-details basketball-game-tracker" role="dialog" aria-modal="false" aria-label={`${names.away}${game.neutral_site ? " vs " : " at "}${names.home} GameTracker`}>
      <header className="game-tracker-header"><div className="game-detail-title"><strong>{names.away}{game.neutral_site ? " vs " : " at "}{names.home}</strong></div><GameDetailClose onClose={close} label="Close GameTracker" /></header>
      <div className="game-tracker-scoreboard"><div className="game-tracker-scoreboard-grid">
        {(["away", "home"] as const).map(side => <div className={`game-tracker-score-team ${side}`} key={side}>
          <div className="game-tracker-score-team-main">{logos[side] ? <Image unoptimized src={logos[side]!} alt={names[side]} width={60} height={60} /> : <span className="game-tracker-logo-fallback">{names[side].slice(0, 1)}</span>}<div className="game-tracker-score-stack"><small className="broadcast-team-record">{payload?.teams[side]?.records?.[0]?.summary || ""}</small><b className={completed && scores.away != null && scores.home != null ? scores[side]! > scores[side === "away" ? "home" : "away"]! ? "winner" : "loser" : ""}>{scores[side] ?? "—"}</b>{!completed && !pregame && <div className="basketball-team-indicators"><span className="basketball-team-timeouts" aria-label={timeoutCount(side) == null ? "Timeouts unavailable" : `${timeoutCount(side)} timeouts left`}>{game.league === "NBA" ? `TO: ${timeoutCount(side) ?? "—"}` : timeoutCount(side) == null ? <span className="basketball-timeout-unavailable">TO: —</span> : <span className="game-tracker-timeout-dots">{[0, 1, 2, 3].map(i => <i key={i} className={i < timeoutCount(side)! ? "active" : ""} />)}</span>}</span><small className="basketball-team-fouls">Fouls: {foulsCount(side) ?? "—"}</small></div>}</div></div>
        </div>)}
        <div className={`game-tracker-score-center ${completed ? "final" : ""}`}>
          {completed && <time className="broadcast-game-date" dateTime={game.commence_time}>{new Date(game.commence_time).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Chicago" })}</time>}
          {completed ? <strong>FINAL</strong> : pregame ? <><span>TIPOFF</span><strong className="basketball-tipoff-time">{new Date(game.commence_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}</strong><small>CT</small></> : <><span className="game-tracker-center-period">{basketballPeriod(payload?.status.period || 1)}</span><strong className="game-tracker-center-clock">{payload?.status.clock || game.live_status?.match(/\d{1,2}:\d{2}/)?.[0] || "—"}</strong></>}
        </div>
      </div></div>
      <nav className="game-tracker-tabs tracker-primary-tabs" aria-label="Basketball game sections"><button type="button" className={tab !== "box" ? "active" : ""} aria-current={tab !== "box" ? "page" : undefined} onClick={() => { setTab(completed ? "scoring" : "live"); scrollArea.current?.scrollTo(0, 0); }}>GameTracker</button><button type="button" className={tab === "box" ? "active" : ""} aria-current={tab === "box" ? "page" : undefined} onClick={() => { setTab("box"); scrollArea.current?.scrollTo(0, 0); }}>Box Score</button></nav>
      <div ref={scrollArea} className="game-tracker-scroll">
        {tab !== "box" && <nav className="tracker-inner-switch" aria-label="Basketball GameTracker views">{tabs.filter(([id]) => id !== "box").map(([id,label]) => <button type="button" key={id} className={tab === id ? "active" : ""} aria-pressed={tab === id} onClick={() => { setTab(id); scrollArea.current?.scrollTo(0, 0); }}>{label}</button>)}</nav>}
        {!payload && !error && <div className="game-tracker-loading" role="status"><LoaderCircle size={22} /><span>Loading game…</span></div>}
        {error && <div className="game-tracker-empty" role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
        {payload && tab === "live" && <BasketballLiveCourt shots={payload.shots || []} plays={payload.plays || []} possessionSide={payload.liveState?.possessionSide || null} latestAction={payload.liveState?.latestAction || null} away={names.away} home={names.home}
          awayId={String(payload.teams.away?.team?.id || "away")} homeId={String(payload.teams.home?.team?.id || "home")} college={game.league === "CBB"} awayLogo={logos.away} homeLogo={logos.home} winProbability={payload.winProbability || []} />}
        {payload && tab === "scoring" && <BasketballScoreFlow plays={payload.plays || []} away={names.away} home={names.home} awayLogo={logos.away} homeLogo={logos.home} college={game.league === "CBB"} />}
        {payload && tab === "plays" && <BasketballShotChart key={game.id} shots={payload.shots || []} attempts={payload.shotAttempts || 0} college={game.league === "CBB"} period={payload.status.period || 1}
          away={{ id: String(payload.teams.away?.team?.id || "away"), name: names.away, logo: logos.away }}
          home={{ id: String(payload.teams.home?.team?.id || "home"), name: names.home, logo: logos.home }} neutralSite={Boolean(game.neutral_site)} />}
        {payload && (tab === "plays" || tab === "scoring") && <div className="basketball-play-list">{!periodGroups.length && <p className="game-tracker-empty">{pregame ? "Play-by-play begins at tipoff." : "No plays available yet."}</p>}{periodGroups.map((group, index) => <section className="basketball-play-period" key={`${group.period}-${index}`} aria-label={`${basketballPeriodLabel(group.period, game.league === "CBB")} ${tab}`}>
          <div className="game-tracker-quarter-header"><span>{basketballPeriodLabel(group.period, game.league === "CBB")}</span><div className="basketball-period-scores">{(["away", "home"] as const).map(side => logos[side] ? <Image unoptimized key={side} src={logos[side]!} alt={names[side]} width={22} height={22} /> : <span key={side}>{names[side]}</span>)}</div></div>
          {group.plays.map((play, index) => <div className="basketball-play" key={play.id}><p><time>{play.clock},</time> {playTextWithoutDuplicateClock(play.text, play.clock)}</p>{scoreChanged(play, group.plays[index + (completed ? -1 : 1)]) && <div className="basketball-period-scores basketball-play-score" aria-label={`${names.away} ${play.awayScore ?? "—"}, ${names.home} ${play.homeScore ?? "—"}`}>{(["away", "home"] as const).map(side => <span className="basketball-play-team-score" key={side}><strong>{side === "away" ? play.awayScore ?? "—" : play.homeScore ?? "—"}</strong></span>)}</div>}</div>)}
        </section>)}</div>}
        {payload && tab === "box" && <div className="game-tracker-box"><BasketballLineScore plays={payload.plays || []} college={game.league === "CBB"} names={names} logos={logos} finalScores={scores} />
          <div className="game-tracker-box-selector" role="group" aria-label="Box score team">{(["away", "all", "home"] as const).map(side => <button type="button" key={side} className={boxTeam === side ? "active" : ""} aria-pressed={boxTeam === side} onClick={() => setBoxTeam(side)}>{side === "all" ? "Team" : <>{logos[side] && <Image unoptimized src={logos[side]!} alt="" width={20} height={20} />}<span>{teamAbbreviatedName(game.league, game[`${side}_team`])}</span></>}</button>)}</div>
          {boxTeam === "all" && (payload.stats.length > 0 ? teamStats : <p className="game-tracker-empty">Team statistics will appear when available.</p>)}
          {boxTeam !== "all" && !payload.players.length && <p className="game-tracker-empty">Box scores appear when available.</p>}
          {payload.players.filter(team => boxTeam !== "all" && team.side === boxTeam).map(team => <div key={team.id} className="game-tracker-team-box basketball-team-box">
            {team.groups.map((group, index) => <section className="game-tracker-box-section" key={index}>
              <div className="game-tracker-player-table-scroll basketball-table-scroll" tabIndex={0} role="region" aria-label={`${teamDisplayName(game.league, team.name)} player statistics, scroll horizontally for more columns`}>
                <table className="game-tracker-player-table basketball-player-table" aria-label={`${teamDisplayName(game.league, team.name)} player statistics`} style={{ minWidth: `${Math.max(340, 120 + group.labels.length * 44)}px` }}>
                  <colgroup><col style={{ width: 120 }} />{group.labels.map((label, i) => <col key={i} />)}</colgroup>
                  <thead><tr><th scope="col">Players</th>{group.labels.map((label, i) => <th scope="col" key={i}>{label}</th>)}</tr></thead>
                  <tbody>{group.athletes.map(athlete => <tr key={athlete.id}><th scope="row" title={athlete.name}>{shortPlayerName(athlete.name)}</th>{group.labels.map((_, i) => <td key={i}>{athlete.stats[i] ?? "—"}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </section>)}
          </div>)}
        </div>}
      </div>
    </section>
  </div>, document.body);
}
