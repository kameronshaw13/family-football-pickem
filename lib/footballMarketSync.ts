import { fetchActionNetworkMarkets } from "@/lib/actionNetworkMarkets";
import { fetchEspnSchedule } from "@/lib/espnSchedule";
import { espnRankForLogo, fetchEspnCfbRankMap } from "@/lib/espnRankings";
import { canRefreshSpread, getFootballWeek, getGameLockTime, getSpreadFreezeTime } from "@/lib/lockRules";
import { createNotificationSafely } from "@/lib/notifications";
import { notificationTeamName } from "@/lib/notificationTeamName";
import { isEligibleSeasonGame } from "@/lib/seasonRules";
import { normalizeSpreadForSelectedTeam, spreadText, underdogWinValue } from "@/lib/spreads";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import type { Game, League, SideBetMarketQuote } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;

function winWord(value: number) {
  return `${value} win${value === 1 ? "" : "s"}`;
}

function targetWindow(now = new Date()) {
  return {
    start: new Date(now.getTime() - DAY_MS),
    end: new Date(now.getTime() + 14 * DAY_MS)
  };
}

function dateHintsForWindow(now = new Date()) {
  const { start, end } = targetWindow(now);
  const hints: string[] = [];
  for (let at = start.getTime(); at <= end.getTime(); at += DAY_MS) {
    hints.push(new Date(at).toISOString());
  }
  return hints;
}

export async function syncUpcomingFootballSchedule(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  now = new Date()
) {
  const { start, end } = targetWindow(now);
  const existingResult = await supabase
    .from("games")
    .select("id,espn_event_id")
    .gte("commence_time", start.toISOString())
    .lte("commence_time", end.toISOString());
  if (existingResult.error) throw new Error(existingResult.error.message);

  const existingByEspnId = new Map<string, string>();
  for (const game of existingResult.data || []) {
    if (game.espn_event_id) existingByEspnId.set(String(game.espn_event_id), String(game.id));
  }

  const rankMap = await fetchEspnCfbRankMap();
  const dateHints = dateHintsForWindow(now);
  const rows: any[] = [];

  for (const league of ["CFB", "NFL"] as League[]) {
    const schedule = await fetchEspnSchedule(league, dateHints, 15 * 60, 0);
    for (const event of schedule) {
      const game = {
        league,
        commence_time: event.commenceTime,
        home_team: event.homeTeam.displayName,
        away_team: event.awayTeam.displayName,
        home_logo_url: event.homeTeam.logoUrl,
        away_logo_url: event.awayTeam.logoUrl
      };
      if (!isEligibleSeasonGame(game)) continue;

      const lockTime = getGameLockTime(event.commenceTime);
      rows.push({
        id: existingByEspnId.get(event.id) || event.id,
        espn_event_id: event.id,
        week: getFootballWeek(event.commenceTime),
        league,
        commence_time: event.commenceTime,
        home_team: event.homeTeam.displayName,
        away_team: event.awayTeam.displayName,
        home_logo_url: event.homeTeam.logoUrl,
        away_logo_url: event.awayTeam.logoUrl,
        home_rank: league === "CFB" ? espnRankForLogo(rankMap, event.homeTeam.logoUrl) : null,
        away_rank: league === "CFB" ? espnRankForLogo(rankMap, event.awayTeam.logoUrl) : null,
        lock_time: lockTime.toISOString(),
        is_locked: now >= lockTime,
        updated_at: now.toISOString()
      });
    }
  }

  if (rows.length) {
    const { error } = await supabase.from("games").upsert(rows, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }

  return { gamesDiscovered: rows.length, start: start.toISOString(), end: end.toISOString() };
}

async function reconcileDraftDogs(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  changedGames: Game[],
  previousGames: Map<string, Game>,
  changedAt: Date
) {
  if (!changedGames.length) return { removed: 0, tierChanged: 0 };

  const changedById = new Map(changedGames.map((game) => [game.id, game]));
  const { data: draftDogs, error } = await supabase
    .from("picks")
    .select("id,user_id,group_id,game_id,selected_team,underdog_win_value")
    .eq("status", "draft")
    .eq("pick_type", "underdog")
    .in("game_id", changedGames.map((game) => game.id));
  if (error) throw new Error(`Could not reconcile dog picks: ${error.message}`);

  let removed = 0;
  let tierChanged = 0;
  const notifications: Promise<unknown>[] = [];

  for (const pick of draftDogs || []) {
    const game = changedById.get(pick.game_id);
    if (!game) continue;
    const oldGame = previousGames.get(pick.game_id);
    const oldSpread = oldGame
      ? normalizeSpreadForSelectedTeam(pick.selected_team, oldGame.current_spread_team, oldGame.current_spread)
      : null;
    const newSpread = normalizeSpreadForSelectedTeam(pick.selected_team, game.current_spread_team, game.current_spread);
    const oldValue = pick.underdog_win_value == null ? underdogWinValue(oldSpread) : Number(pick.underdog_win_value);
    const newValue = underdogWinValue(newSpread);
    const selectedTeam = notificationTeamName(pick.selected_team, game.league);

    if (newValue === 0) {
      const { data: deleted, error: deleteError } = await supabase
        .from("picks")
        .delete()
        .eq("id", pick.id)
        .eq("status", "draft")
        .select("id")
        .maybeSingle();
      if (deleteError) throw new Error(`Could not remove invalid dog pick: ${deleteError.message}`);
      if (!deleted) continue;
      removed += 1;
      notifications.push(createNotificationSafely(supabase, {
        groupId: pick.group_id,
        userId: pick.user_id,
        type: "dog_pick_adjustment",
        destination: "my_card",
        entityId: pick.id,
        dedupeKey: `dog-adjust:${pick.id}:${changedAt.getTime()}:${oldValue}:0`,
        title: "Dog pick removed",
        body: `${selectedTeam} was removed as your dog: ${spreadText(oldSpread)} → ${spreadText(newSpread)}. Dogs must be +7 or higher.`,
        url: `/?group=${encodeURIComponent(pick.group_id)}&notification=my_card`,
        actionRequired: true
      }));
      continue;
    }

    if (newValue === oldValue) continue;
    const { data: updated, error: updateError } = await supabase
      .from("picks")
      .update({ underdog_win_value: newValue, updated_at: changedAt.toISOString() })
      .eq("id", pick.id)
      .eq("status", "draft")
      .select("id")
      .maybeSingle();
    if (updateError) throw new Error(`Could not update dog pick value: ${updateError.message}`);
    if (!updated) continue;

    tierChanged += 1;
    notifications.push(createNotificationSafely(supabase, {
      groupId: pick.group_id,
      userId: pick.user_id,
      type: "dog_pick_adjustment",
      destination: "my_card",
      entityId: pick.id,
      dedupeKey: `dog-adjust:${pick.id}:${changedAt.getTime()}:${oldValue}:${newValue}`,
      title: "Dog value changed",
      body: `${selectedTeam} changed from +${winWord(oldValue)} to +${winWord(newValue)}: ${spreadText(oldSpread)} → ${spreadText(newSpread)}.`,
      url: `/?group=${encodeURIComponent(pick.group_id)}&notification=my_card`,
      actionRequired: true
    }));
  }

  if (notifications.length) await Promise.all(notifications);
  return { removed, tierChanged };
}

export async function persistActionNetworkSpreads(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  games: Game[],
  markets: SideBetMarketQuote[],
  now = new Date()
) {
  const quotesById = new Map(markets.map((quote) => [quote.gameId, quote]));
  const previousGames = new Map(games.map((game) => [game.id, game]));
  const changedGames: Game[] = [];
  const snapshots: any[] = [];

  for (const game of games) {
    const quote = quotesById.get(game.id);
    const spread = quote?.phase === "pregame" && quote.spread && !quote.spread.suspended ? quote.spread : null;
    if (!spread || !canRefreshSpread(game.commence_time, now)) continue;

    const nextAwaySpread = Number(spread.awayPoint);
    if (!Number.isFinite(nextAwaySpread)) continue;
    const previousAwaySpread = normalizeSpreadForSelectedTeam(game.away_team, game.current_spread_team, game.current_spread);
    if (previousAwaySpread != null && Math.abs(previousAwaySpread - nextAwaySpread) < 0.001) continue;

    const changed: Game = {
      ...game,
      current_spread_team: game.away_team,
      current_spread: nextAwaySpread,
      current_bookmaker: "Market",
      updated_at: now.toISOString()
    };
    changedGames.push(changed);
    snapshots.push({
      game_id: game.id,
      league: game.league,
      spread_team: game.away_team,
      spread: nextAwaySpread,
      bookmaker: "Market",
      raw: {
        provider: "Action Network",
        phase: quote?.phase,
        spread,
        spread_freeze_time: getSpreadFreezeTime(game.commence_time).toISOString()
      }
    });
  }

  if (changedGames.length) {
    const { error } = await supabase.from("games").upsert(changedGames, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }
  if (snapshots.length) {
    const { error } = await supabase.from("odds_snapshots").insert(snapshots);
    if (error) throw new Error(error.message);
  }

  const dogAdjustments = await reconcileDraftDogs(supabase, changedGames, previousGames, now);
  return { gamesUpdated: changedGames.length, changedGames, dogAdjustments };
}

export async function refreshActionNetworkSpreads(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  games: Game[],
  now = new Date()
) {
  const markets = await fetchActionNetworkMarkets(games);
  const persisted = await persistActionNetworkSpreads(supabase, games, markets, now);
  return { markets, ...persisted };
}
