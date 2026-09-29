import { getSupabaseAdmin } from "./supabaseServer";
import type { SportsDataRow } from "./cfbMatchupData";

async function loadSnapshot(league: "CFB" | "NFL", season: number, throughWeek: number) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("matchup_stat_snapshots")
    .select("through_week,source,source_updated_at,fetched_at,payload")
    .eq("league", league)
    .eq("season", season)
    .eq("through_week", throughWeek)
    .maybeSingle();

  if (error || !data) return null;
  return data as {
    through_week: number;
    source: string;
    source_updated_at: string | null;
    fetched_at: string;
    payload: any;
  };
}

export async function loadStoredCfbSnapshot(season: number, throughWeek: number) {
  const row = await loadSnapshot("CFB", season, throughWeek);
  if (!row) return null;
  const summaries = Array.isArray(row.payload?.summaries) ? row.payload.summaries as SportsDataRow[] : [];
  const fpi = Array.isArray(row.payload?.fpi) ? row.payload.fpi as SportsDataRow[] : [];
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
  const rows = Array.isArray(row.payload?.rows) ? row.payload.rows as SportsDataRow[] : [];
  if (!rows.length) return null;
  return {
    throughWeek: row.through_week,
    source: row.source,
    sourceUpdatedAt: row.source_updated_at,
    fetchedAt: row.fetched_at,
    rows
  };
}
