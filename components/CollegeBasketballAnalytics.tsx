"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { getClientSessionToken } from "@/lib/clientSession";
import { TORVIK_METRICS, TORVIK_PLAYER_COLUMNS, type TorvikTeam, type TorvikValue } from "@/lib/torvikData";

type Payload = { year: number; fetchedAt: string; stale: boolean; factorsAvailable: boolean; teams: { away: TorvikTeam | null; home: TorvikTeam | null } };
function Stat({ data, format }: { data?: TorvikValue; format?: string }) {
  if (data?.value == null) return <span>—</span>;
  const n = data.value;
  const value = format === "integer" ? String(Math.round(n)) : format === "rating" ? n.toFixed(3) : format === "probability" ? `${(n * 100).toFixed(1)}%` : `${format === "signed" && n > 0 ? "+" : ""}${n.toFixed(1)}${format === "percent" ? "%" : ""}`;
  return <span>{value}{data.rank != null && <small>#{data.rank}</small>}</span>;
}

export default function CollegeBasketballAnalytics({ gameId }: { gameId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setData(null); setError("");
    fetch(`/api/cbb-analytics?gameId=${encodeURIComponent(gameId)}`, { headers: { Authorization: `Bearer ${getClientSessionToken()}`, "x-pickem-group": "friends-basketball" }, cache: "no-store", signal: controller.signal })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "Could not load advanced stats."); return body as Payload; })
      .then(body => { if (active) setData(body); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Could not load advanced stats."); });
    return () => { active = false; controller.abort(); };
  }, [gameId, retry]);
  if (error) return <section className="cbb-analytics"><p role="alert">{error}</p><button type="button" className="btn" onClick={() => setRetry(x => x + 1)}>Try again</button></section>;
  if (!data) return <div className="game-tracker-loading" role="status"><LoaderCircle size={20} /><span>Loading advanced stats…</span></div>;
  const { away, home } = data.teams;
  const preseason = !(away?.games || home?.games);
  return <section className="cbb-analytics" aria-label="College basketball advanced stats">
    <header><div><h3>Advanced Stats</h3><p>{data.year - 1}–{String(data.year).slice(-2)} {preseason ? "preseason projections" : "season ratings"}</p></div><a href={`https://barttorvik.com/?year=${data.year}`} target="_blank" rel="noreferrer">T-Rank</a></header>
    <p className="cbb-stats-key">Efficiency: points per 100 possessions. Tempo: possessions per 40 minutes. Small numbers show national rank.</p>
    {(!away || !home) && <p className="cbb-stats-key">Ratings aren’t available for {!away && !home ? "these teams" : !away ? "the away team" : "the home team"} yet.</p>}
    {data.stale && <p className="cbb-stats-key">Showing the last available ratings from {new Date(data.fetchedAt).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} CT.</p>}
    {[...new Set(TORVIK_METRICS.map(metric => metric.group))].map((group, index) => {
      const metrics = TORVIK_METRICS.filter(metric => metric.group === group);
      const available = metrics.some(metric => away?.metrics[metric.key]?.value != null || home?.metrics[metric.key]?.value != null);
      return <details className="cbb-stat-section" key={group} open={index === 0 || (group === "Four Factors" && available)}>
        <summary>{group}</summary>
        {available ? <table className="cbb-advanced-table"><thead><tr><th scope="col">{away?.name || "Away"}</th><th scope="col">Stat</th><th scope="col">{home?.name || "Home"}</th></tr></thead><tbody>{metrics.map(metric => {
          const format = metric.format || (["confWinPct", "qualBarthag"].includes(metric.key) ? "probability" : /sos/i.test(metric.key) ? "rating" : undefined);
          return <tr key={metric.key}><td><Stat data={away?.metrics[metric.key]} format={format} /></td><th scope="row">{metric.label}</th><td><Stat data={home?.metrics[metric.key]} format={format} /></td></tr>;
        })}</tbody></table>
          : <p className="cbb-stats-key">{preseason ? "These stats begin after regular-season games are played." : "These stats have not been published yet."}</p>}
      </details>;
    })}
    <details className="cbb-stat-section"><summary>Player Advanced Stats</summary>
      {[away, home].map((team, side) => <section key={side} className="cbb-player-section"><h4>{team?.name || (side ? "Home" : "Away")}</h4>
        {team?.players.length ? <div className="basketball-table-scroll" tabIndex={0} role="region" aria-label={`${team.name} advanced player statistics`}><table className="cbb-player-table"><thead><tr><th scope="col">Player</th><th scope="col">GP</th>{TORVIK_PLAYER_COLUMNS.map(([, key]) => <th scope="col" key={key}>{key}</th>)}</tr></thead><tbody>{team.players.map(player => <tr key={player.id}><th scope="row">{player.name}</th><td>{player.games}</td>{TORVIK_PLAYER_COLUMNS.map(([, key]) => <td key={key}>{player.metrics[key]?.toFixed(1) ?? "—"}</td>)}</tr>)}</tbody></table></div> : <p className="cbb-stats-key">Current-season player stats will appear when available.</p>}
      </section>)}
    </details>
  </section>;
}
