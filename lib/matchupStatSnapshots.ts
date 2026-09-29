import { getSupabaseAdmin } from "./supabaseServer";
import type { SportsDataRow } from "./cfbMatchupData";

type SnapshotRow = {
  through_week: number;
  source: string;
  source_updated_at: string | null;
  fetched_at: string;
  payload: Record<string, unknown> | null;
};

async function loadSnapshot(league: "CFB" | "NFL", season: number, throughWeek: number) {
  const { data, error } = await getSupabaseAdmin()
    .from("matchup_stat_snapshots")
    .select("through_week,source,source_updated_at,fetched_at,payload")
    .eq("league", league)
    .eq("season", season)
    .lte("through_week", throughWeek)
    .order("through_week", { ascending: false })
    .limit(1)
    .maybeSingle()
    .abortSignal(AbortSignal.timeout(5_000));
  if (error) return null;
  return data as SnapshotRow | null;
}

export async function loadStoredCfbSnapshot(season: number, throughWeek: number) {
  const row = await loadSnapshot("CFB", season, throughWeek);
  if (!row) return null;
  const payload = row.payload || {};
  const summaries = Array.isArray(payload.summaries) ? payload.summaries as SportsDataRow[] : [];
  const fpi = Array.isArray(payload.fpi) ? payload.fpi as SportsDataRow[] : [];
  if (!summaries.length) return null;
  return {
    throughWeek: row.through_week,
    source: row.source,
    sourceUpdatedAt: row.source_updated_at,
    fetchedAt: row.fetched_at,
    summaries,
    fpi
  };
}

export async function loadStoredNflSnapshot(season: number, throughWeek: number) {
  const row = await loadSnapshot("NFL", season, throughWeek);
  if (!row) return null;
  const payload = row.payload || {};
  const rows = Array.isArray(payload.rows) ? payload.rows as SportsDataRow[] : [];
  if (!rows.length) return null;
  return {
    throughWeek: row.through_week,
    source: row.source,
    sourceUpdatedAt: row.source_updated_at,
    fetchedAt: row.fetched_at,
    rows
  };
}
