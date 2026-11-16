import type { SupabaseClient } from "@supabase/supabase-js";
import type { Game } from "./types";
import { basketballGameAvailableForSideBets, basketballGameInSeason, basketballLockTime, basketballPickLockTime, basketballWeek, BASKETBALL_LEAGUES } from "./basketballRules";
import { fetchEspnDivisionOneTeamIds, isDivisionOneMatchup } from "./espnDivisionOne";
import { fetchEspnSchedule } from "./espnSchedule";
import { recoverMissingClosingSpreads } from "./closingSpreadSync";
import { refreshActionNetworkSpreads } from "./footballMarketSync";

/** Stable ESPN event ids keep repeat matchups in the same week separate. */
export async function refreshBasketballSlate(supabase: SupabaseClient, now = new Date()) {
  const start = new Date(now.getTime() - 86400000);
  const end = new Date(now.getTime() + 14 * 86400000);
  const hints = Array.from({ length: 16 }, (_, index) => new Date(start.getTime() + index * 86400000).toISOString());
  const existing: Game[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("games").select("*")
      .in("league", [...BASKETBALL_LEAGUES])
      .gte("commence_time", start.toISOString()).lte("commence_time", end.toISOString())
      .order("id", { ascending: true }).range(offset, offset + 499);
    if (error) throw new Error(error.message);
    existing.push(...((data || []) as Game[]));
    if ((data || []).length < 500) break;
  }
  const prior = new Map((existing || []).map((game: any) => [game.id, game]));
  const rows: any[] = [];
  const scheduleErrors: string[] = [];
  let successfulSchedules = 0;
  const completedIds = new Set<string>();
  // Don't show a CBB matchup unless both schools are verified Division I.
  // A directory outage should not stop the NBA schedule from updating.
  const divisionOneIds = await fetchEspnDivisionOneTeamIds().catch((reason) => {
    console.warn("[basketballSync] CBB D-I directory unavailable; skipping unverified college games.", reason);
    return null;
  });
  for (const league of BASKETBALL_LEAGUES) {
    if (league === "CBB" && !divisionOneIds) {
      scheduleErrors.push("CBB Division I directory unavailable");
      continue;
    }
    let schedule;
    try {
      schedule = await fetchEspnSchedule(league, hints, true, 0);
      successfulSchedules += 1;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      console.error(`[basketballSync] ${league} schedule unavailable; retaining saved games.`, reason);
      scheduleErrors.push(`${league}: ${message}`);
      continue;
    }
    for (const event of schedule) {
      if (!event.timeValid ||
        (league === "NBA" && (!basketballGameAvailableForSideBets(event.commenceTime) || event.seasonType !== 2)) ||
        (league === "CBB" && (!basketballGameInSeason(event.commenceTime) || event.seasonType === 1 || !isDivisionOneMatchup(event.homeTeam.id, event.awayTeam.id, divisionOneIds ?? new Set<string>())))) continue;
      const id = `espn-${league.toLowerCase()}-${event.id}`;
      if (event.completed) completedIds.add(id);
      const lock = basketballPickLockTime(event.commenceTime);
      // Schedule writes never include a saved line, bookmaker, or final score.
      rows.push({
        id, espn_event_id: event.id, week: basketballWeek(new Date(event.commenceTime)), league,
        commence_time: event.commenceTime,
        home_team: event.homeTeam.displayName, away_team: event.awayTeam.displayName,
        neutral_site: Boolean(event.neutralSite),
        home_logo_url: event.homeTeam.logoUrl, away_logo_url: event.awayTeam.logoUrl,
        home_rank: league === "CBB" ? event.homeTeam.rank ?? null : null,
        away_rank: league === "CBB" ? event.awayTeam.rank ?? null : null,
        lock_time: lock.toISOString(), is_locked: now >= lock,
        schedule_source_updated_at: now.toISOString(),
        updated_at: now.toISOString()
      });
    }
  }
  for (let index = 0; index < rows.length; index += 200) {
    const result = await supabase.from("games").upsert(rows.slice(index, index + 200), { onConflict: "id" });
    if (result.error) throw new Error(result.error.message);
  }
  if (successfulSchedules === 0) throw new Error(`All basketball schedule feeds unavailable: ${scheduleErrors.join("; ")}`);
  const hydrated: Game[] = rows.map((row) => {
    const old = prior.get(row.id);
    return {
      ...old, ...row,
      current_spread_team: old?.current_spread_team ?? null,
      current_spread: old?.current_spread ?? null,
      current_bookmaker: old?.current_bookmaker ?? null,
      final_home_score: old?.final_home_score ?? null,
      final_away_score: old?.final_away_score ?? null,
      created_at: old?.created_at ?? now.toISOString()
    } as Game;
  });
  const upcoming = hydrated.filter((game) => now < basketballLockTime(game.commence_time));
  const result = upcoming.length ? await refreshActionNetworkSpreads(supabase, upcoming, now) : { gamesUpdated: 0 };
  const closingSpreadsRecovered = await recoverMissingClosingSpreads(supabase, hydrated.filter(game => completedIds.has(game.id)));
  return { gamesDiscovered: rows.length, gamesUpdated: result.gamesUpdated, closingSpreadsRecovered, scheduleErrors };
}
