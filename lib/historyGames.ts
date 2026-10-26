import { getSupabaseAdmin } from "./supabaseServer";
import type { LocalGame } from "./cfbMatchupData";

/** Read every history row before merging imports; a fixed cap can omit later weeks. */
export async function loadHistoryGames(league: "NFL" | "CFB", season: number, before: string, teams?: string[]) {
  const supabase = getSupabaseAdmin();
  const data: LocalGame[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = supabase.from("games")
      .select("id,week,commence_time,home_team,away_team,current_spread_team,current_spread,final_home_score,final_away_score,espn_event_id,updated_at")
      .eq("league", league).gte("commence_time", `${season}-08-01T00:00:00Z`).lt("commence_time", before)
      .order("commence_time").order("id").range(offset, offset + 999);
    if (teams?.length) {
      const values = teams.map(team => JSON.stringify(team)).join(",");
      query = query.or(`home_team.in.(${values}),away_team.in.(${values})`);
    }
    const page = await query.abortSignal(AbortSignal.timeout(8000));
    if (page.error) throw new Error(page.error.message);
    data.push(...(page.data || []) as LocalGame[]);
    if ((page.data || []).length < 1000) return { data, error: null };
  }
}
