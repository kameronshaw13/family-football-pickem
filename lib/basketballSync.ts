import type { SupabaseClient } from "@supabase/supabase-js";
import type { Game } from "./types";
import { basketballDateChanged, basketballGameAvailableForSideBets, basketballGameInSeason, basketballLockTime, basketballPickLockTime, basketballWeek, BASKETBALL_LEAGUES } from "./basketballRules";
import { fetchEspnDivisionOneTeamIds, isDivisionOneMatchup } from "./espnDivisionOne";
import { fetchEspnEvent, fetchEspnSchedule, findEspnScheduleMatch, type EspnScheduleGame } from "./espnSchedule";
import { recoverMissingClosingSpreads } from "./closingSpreadSync";
import { refreshActionNetworkSpreads } from "./footballMarketSync";

/** Stable ESPN event ids keep repeat matchups in the same week separate. */
function chicagoDate(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function gameHasWagers(supabase: SupabaseClient, id: string) {
  const [picks, bets] = await Promise.all([
    supabase.from("picks").select("id").eq("game_id", id).limit(1),
    supabase.from("side_bets").select("id").eq("game_id", id).limit(1)
  ]);
  if (picks.error) throw new Error(picks.error.message);
  if (bets.error) throw new Error(bets.error.message);
  return Boolean(picks.data?.length || bets.data?.length);
}

export async function voidRescheduledGame(supabase: SupabaseClient, id: string, now: Date, eventStatus = "STATUS_RESCHEDULED") {
  const updated_at = now.toISOString();
  // A push voids the pick without a win or loss. A settled push releases both
  // sides' reserved side-bet stakes through the existing bank calculation.
  const writes = [
    supabase.from("picks").delete().eq("game_id", id).eq("status", "draft"),
    supabase.from("picks").update({ result: "push", updated_at }).eq("game_id", id).eq("status", "locked").eq("result", "pending"),
    supabase.from("side_bets").update({ status: "settled", result: "push", winner_id: null, updated_at }).eq("game_id", id).eq("status", "accepted"),
    supabase.from("side_bets").update({ status: "cancelled", updated_at }).eq("game_id", id).eq("status", "open")
  ];
  const results = await Promise.all(writes);
  for (const result of results) if (result.error) throw new Error(result.error.message);
  const marked = await supabase.from("games").update({ event_status: eventStatus, updated_at }).eq("id", id);
  if (marked.error) throw new Error(marked.error.message);
}

export function basketballScheduleRow(league: Game["league"], event: EspnScheduleGame, old: Game | undefined, now: Date, idOverride?: string) {
  const match = old ? findEspnScheduleMatch(old, [event]) : null;
  const home = match?.swapped ? event.awayTeam : event.homeTeam;
  const away = match?.swapped ? event.homeTeam : event.awayTeam;
  const lock = basketballPickLockTime(event.commenceTime);
  const nextWeek = basketballWeek(new Date(event.commenceTime));
  const moved = old && Number.isFinite(new Date(old.commence_time).getTime())
    && new Date(old.commence_time).getTime() !== new Date(event.commenceTime).getTime();
  return {
    id: idOverride || `espn-${league.toLowerCase()}-${event.id}`, espn_event_id: event.id, week: nextWeek, league,
    commence_time: event.commenceTime,
    home_team: home.displayName, away_team: away.displayName,
    neutral_site: Boolean(event.neutralSite), event_status: event.statusName,
    home_logo_url: home.logoUrl, away_logo_url: away.logoUrl,
    home_rank: league === "CBB" ? home.rank ?? null : null,
    away_rank: league === "CBB" ? away.rank ?? null : null,
    lock_time: lock.toISOString(), is_locked: now >= lock,
    ...(moved ? { current_spread_team: null, current_spread: null, current_bookmaker: null } : {}),
    schedule_source_updated_at: now.toISOString(), updated_at: now.toISOString()
  };
}

export async function refreshBasketballSlate(supabase: SupabaseClient, now = new Date()) {
  const start = new Date(now.getTime() - 7 * 86400000);
  const end = new Date(now.getTime() + 14 * 86400000);
  const scheduleStart = new Date(now.getTime() - 86400000);
  const hints = Array.from({ length: 16 }, (_, index) => new Date(scheduleStart.getTime() + index * 86400000).toISOString());
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
  const voidedGames = new Map<string, string>();
  const rowsById = new Map<string, ReturnType<typeof basketballScheduleRow>>();
  const addEvent = async (league: Game["league"], event: EspnScheduleGame) => {
    const baseId = `espn-${league.toLowerCase()}-${event.id}`;
    const date = chicagoDate(event.commenceTime);
    const sameDate = existing.find((game) => game.league === league && String(game.espn_event_id) === event.id && game.commence_time && chicagoDate(game.commence_time) === date);
    const old = sameDate || prior.get(baseId);
    if (old?.commence_time && basketballDateChanged(old.commence_time, event.commenceTime) && await gameHasWagers(supabase, old.id)) {
      const newId = `${baseId}-${date.replaceAll("-", "")}`;
      rowsById.set(newId, basketballScheduleRow(league, event, old, now, newId));
      voidedGames.set(old.id, "STATUS_RESCHEDULED");
    } else {
      const row = basketballScheduleRow(league, event, old, now, old?.id || baseId);
      rowsById.set(row.id, row);
      if (old && ["STATUS_POSTPONED", "STATUS_CANCELED", "STATUS_CANCELLED"].includes(event.statusName || "")
        && new Date(event.commenceTime) <= now && await gameHasWagers(supabase, old.id)) {
        voidedGames.set(old.id, event.statusName!);
      }
    }
  };
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
      await addEvent(league, event);
      if (event.completed) completedIds.add(id);
    }
  }
  // A postponed game or a game moved well into the future disappears from the
  // current date scoreboard. Recheck its stable event ID so it cannot remain a
  // phantom pending game in the old week.
  const scheduledEventIds = new Set([...rowsById.values()].map((row) => `${row.league}:${row.espn_event_id}`));
  const stale = existing.filter((game) => game.espn_event_id && !scheduledEventIds.has(`${game.league}:${game.espn_event_id}`)
    && game.event_status !== "STATUS_RESCHEDULED"
    && game.final_home_score == null && game.final_away_score == null
    && new Date(game.commence_time) <= now);
  const reconciled = await Promise.allSettled(stale.map(async (game) => {
    const event = await fetchEspnEvent(game.league, String(game.espn_event_id), true);
    return event ? { league: game.league, event } : null;
  }));
  for (const result of reconciled) if (result.status === "fulfilled" && result.value) await addEvent(result.value.league, result.value.event);
  rows.push(...rowsById.values());
  for (let index = 0; index < rows.length; index += 200) {
    const result = await supabase.from("games").upsert(rows.slice(index, index + 200), { onConflict: "id" });
    if (result.error) throw new Error(result.error.message);
  }
  for (const [id, status] of voidedGames) await voidRescheduledGame(supabase, id, now, status);
  if (successfulSchedules === 0) throw new Error(`All basketball schedule feeds unavailable: ${scheduleErrors.join("; ")}`);
  const hydrated: Game[] = rows.map((row) => {
    const old = prior.get(row.id);
    return {
      ...old, ...row,
      current_spread_team: row.current_spread_team !== undefined ? row.current_spread_team : old?.current_spread_team ?? null,
      current_spread: row.current_spread !== undefined ? row.current_spread : old?.current_spread ?? null,
      current_bookmaker: row.current_bookmaker !== undefined ? row.current_bookmaker : old?.current_bookmaker ?? null,
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
