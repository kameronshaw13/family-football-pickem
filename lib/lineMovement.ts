import { normalizeSpreadForSelectedTeam } from "./spreads.ts";

type Snapshot = { id?: string; spread_team: string; spread: number; created_at: string };
export type LineMovementPoint = { at: string; awaySpread: number; homeSpread: number; change: number | null };

/** A refresh is not a movement. Keep each actual change, including returns to an earlier line. */
export function buildLineMovement(rows: Snapshot[], awayTeam: string): LineMovementPoint[] {
  const points: LineMovementPoint[] = [];
  for (const row of [...rows].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || String(a.id || "").localeCompare(String(b.id || "")))) {
    const awaySpread = normalizeSpreadForSelectedTeam(awayTeam, row.spread_team, row.spread);
    if (awaySpread == null || !Number.isFinite(awaySpread) || !Number.isFinite(Date.parse(row.created_at))) continue;
    const last = points.at(-1);
    if (last && Math.abs(last.awaySpread - awaySpread) < .001) continue;
    points.push({ at: row.created_at, awaySpread, homeSpread: -awaySpread, change: last ? Math.round((awaySpread - last.awaySpread) * 100) / 100 : null });
  }
  return points;
}
