import type { SupabaseClient } from "@supabase/supabase-js";
import { espnSportPath } from "./sportPaths";
import { verifiedClosingSpread } from "./marketSpread";
import type { Game } from "./types";

/** Fill only empty game-display lines after completion. Saved pick spreads and
 * previously frozen game lines are never changed by historical recovery. */
export async function recoverMissingClosingSpreads(supabase: SupabaseClient, games: Game[]) {
  let recovered = 0;
  const candidates = games.filter(game => game.current_spread == null && game.espn_event_id);
  for (let index = 0; index < candidates.length; index += 4) {
    const results = await Promise.allSettled(candidates.slice(index, index + 4).map(async game => {
      const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${espnSportPath(game.league)}/summary?event=${encodeURIComponent(game.espn_event_id!)}`, { cache: "no-store", signal: AbortSignal.timeout(6000) });
      if (!response.ok) return false;
      const data = await response.json();
      if (String(data.header?.id) !== game.espn_event_id || !data.header?.competitions?.[0]?.status?.type?.completed) return false;
      const spread = (data.pickcenter || []).map((row: unknown) => verifiedClosingSpread(game.league, row)).find(Boolean);
      if (!spread) return false;
      const { data: updated, error } = await supabase.from("games").update({
        current_spread_team: game.away_team, current_spread: spread.awayPoint,
        current_bookmaker: "DraftKings (closing)", updated_at: new Date().toISOString()
      }).eq("id", game.id).is("current_spread", null).select("id");
      if (error) throw new Error(error.message);
      return Boolean(updated?.length);
    }));
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) recovered += 1;
      else if (result.status === "rejected") console.warn("[closingSpreadSync] Recovery deferred:", result.reason);
    }
  }
  return recovered;
}
