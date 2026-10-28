import type { SupabaseClient } from "@supabase/supabase-js";
import type { Game } from "./types";
import { basketballGameAvailableForSideBets, basketballGameInSeason, basketballLockTime, basketballWeek, BASKETBALL_LEAGUES } from "./basketballRules";
import { fetchEspnDivisionOneTeamIds, isDivisionOneMatchup } from "./espnDivisionOne";
import { fetchEspnSchedule } from "./espnSchedule";
import { refreshActionNetworkSpreads } from "./footballMarketSync";

/** Stable ESPN event ids keep repeat matchups in the same week separate. */
export async function refreshBasketballSlate(supabase: SupabaseClient, now = new Date()) {
  const start = new Date(now.getTime() - 86400000);
  const end = new Date(now.getTime() + 14 * 86400000);
  const hints = Array.from({ length: 16 }, (_, index) => new Date(start.getTime() + index * 86400000).toISOString());
  const { data: existing, error } = await supabase.from("games").select("*")
    .in("league", [...BASKETBALL_LEAGUES]).gte("commence_time", start.toISOString()).lte("commence_time", end.toISOString()).range(0, 999);
  if (error) throw new Error(error.message);
  const prior = new Map((existing || []).map((game: any) => [game.id, game]));
  const rows: Game[] = [];
  // Don't show a CBB matchup unless both schools are verified Division I.
  // A directory outage should not stop the NBA schedule from updating.
  const divisionOneIds = await fetchEspnDivisionOneTeamIds().catch((reason) => {
    console.warn("[basketballSync] CBB D-I directory unavailable; skipping unverified college games.", reason);
    return new Set<string>();
  });
  for (const league of BASKETBALL_LEAGUES) {
    const schedule = await fetchEspnSchedule(league, hints, true, 0);
    for (const event of schedule) {
      if (!event.timeValid ||
        (league === "NBA" && (!basketballGameAvailableForSideBets(event.commenceTime) || event.seasonType !== 2)) ||
        (league === "CBB" && (!basketballGameInSeason(event.commenceTime) || event.seasonType === 1 || !isDivisionOneMatchup(event.homeTeam.id, event.awayTeam.id, divisionOneIds)))) continue;
      const id = `espn-${league.toLowerCase()}-${event.id}`;
      const old = prior.get(id);
      const lock = basketballLockTime(event.commenceTime);
      rows.push({
        ...old,
        id, espn_event_id: event.id, week: basketballWeek(new Date(event.commenceTime)), league,
        commence_time: event.commenceTime,
        home_team: event.homeTeam.displayName, away_team: event.awayTeam.displayName,
        home_logo_url: event.homeTeam.logoUrl, away_logo_url: event.awayTeam.logoUrl,
        home_rank: league === "CBB" ? event.homeTeam.rank ?? null : null,
        away_rank: league === "CBB" ? event.awayTeam.rank ?? null : null,
        current_spread_team: old?.current_spread_team ?? null,
        current_spread: old?.current_spread ?? null,
        current_bookmaker: old?.current_bookmaker ?? null,
        lock_time: lock.toISOString(), is_locked: Boolean(old?.is_locked || now >= lock),
        final_home_score: old?.final_home_score ?? null, final_away_score: old?.final_away_score ?? null,
        updated_at: now.toISOString()
      });
    }
  }
  for (let index = 0; index < rows.length; index += 200) {
    const result = await supabase.from("games").upsert(rows.slice(index, index + 200), { onConflict: "id" });
    if (result.error) throw new Error(result.error.message);
  }
  const upcoming = rows.filter((game) => now < basketballLockTime(game.commence_time));
  const result = upcoming.length ? await refreshActionNetworkSpreads(supabase, upcoming, now) : { gamesUpdated: 0 };
  return { gamesDiscovered: rows.length, gamesUpdated: result.gamesUpdated };
}
