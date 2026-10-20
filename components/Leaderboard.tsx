"use client";
import type { Standing } from "@/lib/types";
import NumericText from "@/components/NumericText";

function pctText(value: number) { return `${(Number(value || 0) * 100).toFixed(1)}%`; }

function RankNumber({ rank, className }: { rank: number; className: string }) {
  const labels: Record<number, string> = { 1: "First place", 2: "Second place", 3: "Third place" };
  return <span className={`${className} rank-${rank}`} aria-label={labels[rank]}>{rank}</span>;
}

export default function Leaderboard({ rows, pointsMode }: { rows: Array<Standing & { rank?: number }>; pointsMode: boolean }) {
  function rankFor(index: number) {
    if (rows[index].rank) return rows[index].rank;
    const firstMatch = rows.findIndex((row) => row.win_pct === rows[index].win_pct && row.wins === rows[index].wins);
    return firstMatch + 1;
  }

  return <div className={`leaderboard${pointsMode ? " points-mode" : ""}`}>
    <div className="leaderboard-labels">{pointsMode ? <><span>Place</span><span>Player</span><span>Points</span></> : <><span>Place</span><span>Player</span><span>W</span><span>L</span><span>P</span><span>Win %</span></>}</div>
    {rows.map((row, index) => {
      const rank = rankFor(index);
      const hasResults = row.wins + row.losses + row.pushes > 0;
      const pctTone = !hasResults || row.win_pct === 0.5 ? "" : row.win_pct > 0.5 ? "pct-positive" : "pct-negative";
      return <div className="leaderboard-row" key={row.user_id}>
        <RankNumber rank={rank} className="leaderboard-rank" />
        <div className="leaderboard-player"><strong>{row.display_name}</strong></div>
        {pointsMode ? <strong className="leaderboard-points"><NumericText text={Number(row.points || 0)} /></strong> : <>
          <span className="leaderboard-stat">{row.wins}</span>
          <span className="leaderboard-stat">{row.losses}</span>
          <span className="leaderboard-stat">{row.pushes}</span>
          <strong className={`leaderboard-pct ${pctTone}`}><NumericText text={pctText(row.win_pct)} /></strong>
        </>}
      </div>;
    })}
  </div>;
}

