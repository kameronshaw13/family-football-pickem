import { fetchActionNetworkMarkets, fetchActionNetworkScheduledGames, type ActionNetworkScheduledGame } from "@/lib/actionNetworkMarkets";
import { fetchEspnSchedule } from "@/lib/espnSchedule";
import { espnRankForLogo, fetchEspnCfbRankMap } from "@/lib/espnRankings";
import { canRefreshSpread, getFootballWeek, getGameLockTime, getSpreadFreezeTime } from "@/lib/lockRules";
import { createNotificationSafely } from "@/lib/notifications";
import { notificationTeamName } from "@/lib/notificationTeamName";
import { isEligibleSeasonGame } from "@/lib/seasonRules";
import { normalizeSpreadForSelectedTeam, spreadText, underdogWinValue } from "@/lib/spreads";
import { normalizeTeamNameKey, teamDisplayName } from "@/lib/teamNames";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import type { Game, League, SideBetMarketQuote } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;

type TeamIdentity = { name: string; logo: string | null };

function teamIdentityKeys(league: League, values: string[]) {
  return Array.from(new Set(values.flatMap((value) => [
    normalizeTeamNameKey(value),
    normalizeTeamNameKey(teamDisplayName(league, value))
  ]).filter(Boolean)));
}

function matchupIdentityKey(league: League, awayTeam: string, homeTeam: string) {
  return [
    league,
    normalizeTeamNameKey(teamDisplayName(league, awayTeam)),
    normalizeTeamNameKey(teamDisplayName(league, homeTeam))
  ].join(":");
}

function teamIdentitiesOverlap(league: League, left: string[], right: string[]) {
  const leftKeys = new Set(teamIdentityKeys(league, left));
  return teamIdentityKeys(league, right).some((key) => leftKeys.has(key));
}

function findActionScheduleMatch(
  league: League,
  awayValues: string[],
  homeValues: string[],
  actionSchedule: ActionNetworkScheduledGame[]
) {
  return actionSchedule.find((game) =>
    teamIdentitiesOverlap(league, awayValues, [game.awayTeam, ...game.awayAliases]) &&
    teamIdentitiesOverlap(league, homeValues, [game.homeTeam, ...game.homeAliases])
  ) || null;
}

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
  const [existingResult, teamIdentityResult] = await Promise.all([
    supabase
      .from("games")
      .select("id,espn_event_id,league,commence_time,home_team,away_team,home_logo_url,away_logo_url,current_spread_team,current_spread,current_bookmaker,updated_at")
      .gte("commence_time", start.toISOString())
      .lte("commence_time", end.toISOString()),
    supabase
      .from("games")
      .select("league,home_team,away_team,home_logo_url,away_logo_url")
  ]);
  if (existingResult.error) throw new Error(existingResult.error.message);
  if (teamIdentityResult.error) throw new Error(teamIdentityResult.error.message);

  const existingByEspnId = new Map<string, string>();
  const existingByMatchup = new Map<string, any>();
  for (const game of existingResult.data || []) {
    if (game.espn_event_id) existingByEspnId.set(String(game.espn_event_id), String(game.id));

    const matchupKey = matchupIdentityKey(game.league as League, game.away_team, game.home_team);
    const prior = existingByMatchup.get(matchupKey);
    const gameHasSpread = game.current_spread_team != null && game.current_spread != null;
    const priorHasSpread = prior?.current_spread_team != null && prior?.current_spread != null;
    const gameUpdatedAt = new Date(game.updated_at || 0).getTime();
    const priorUpdatedAt = new Date(prior?.updated_at || 0).getTime();

    if (!prior || (gameHasSpread && !priorHasSpread) || (gameHasSpread === priorHasSpread && gameUpdatedAt > priorUpdatedAt)) {
      existingByMatchup.set(matchupKey, game);
    }
  }

  const teamIdentityMap = new Map<string, TeamIdentity>();
  for (const game of teamIdentityResult.data || []) {
    const league = game.league as League;
    const candidates: Array<[string, string | null]> = [
      [game.home_team, game.home_logo_url],
      [game.away_team, game.away_logo_url]
    ];
    for (const [name, logo] of candidates) {
      for (const key of teamIdentityKeys(league, [name])) {
        if (!teamIdentityMap.has(`${league}:${key}`) || logo) {
          teamIdentityMap.set(`${league}:${key}`, { name, logo });
        }
      }
    }
  }

  const rankMap = await fetchEspnCfbRankMap();
  const dateHints = dateHintsForWindow(now);
  const rows: any[] = [];
  const rowByMatchup = new Map<string, any>();
  const actionSchedules = new Map<League, ActionNetworkScheduledGame[]>();
  const matchedActionIds = new Set<string>();

  // Load the DraftKings-backed provider schedule first. ESPN is still the
  // canonical event identity, but ESPN can publish TBD games with timeValid=false
  // and a placeholder timestamp (commonly 04:00 UTC / 11:00 PM CT the prior day).
  // The provider timestamp is used only to resolve those invalid ESPN times and
  // to seed the current DraftKings spread on the canonical ESPN row.
  for (const league of ["CFB", "NFL"] as League[]) {
    actionSchedules.set(league, await fetchActionNetworkScheduledGames(league, dateHints));
  }

  for (const league of ["CFB", "NFL"] as League[]) {
    const actionSchedule = actionSchedules.get(league) || [];
    const schedule = await fetchEspnSchedule(league, dateHints, 15 * 60, 0);
    for (const event of schedule) {
      const matchupKey = matchupIdentityKey(league, event.awayTeam.displayName, event.homeTeam.displayName);
      const existing = existingByMatchup.get(matchupKey);
      const actionMatch = findActionScheduleMatch(
        league,
        [event.awayTeam.displayName, event.awayTeam.location, event.awayTeam.nickname, event.awayTeam.abbreviation],
        [event.homeTeam.displayName, event.homeTeam.location, event.homeTeam.nickname, event.homeTeam.abbreviation],
        actionSchedule
      );
      if (actionMatch) matchedActionIds.add(actionMatch.actionId);

      const existingTime = existing?.commence_time ? new Date(existing.commence_time).getTime() : NaN;
      const espnTime = new Date(event.commenceTime).getTime();
      const existingHasNonPlaceholderTime = Number.isFinite(existingTime) && Math.abs(existingTime - espnTime) > 60 * 1000;
      const commenceTime = event.timeValid
        ? event.commenceTime
        : actionMatch?.commenceTime || (existingHasNonPlaceholderTime ? existing.commence_time : null);

      // Never write ESPN's invalid/TBD placeholder as a real kickoff. If no
      // verified provider or previously verified time exists yet, wait for the
      // next schedule refresh rather than showing a fake Friday 11 PM game.
      if (!commenceTime) continue;

      const providerSpread = actionMatch?.spread && !actionMatch.spread.suspended ? actionMatch.spread : null;
      const game = {
        league,
        commence_time: commenceTime,
        home_team: event.homeTeam.displayName,
        away_team: event.awayTeam.displayName,
        home_logo_url: event.homeTeam.logoUrl,
        away_logo_url: event.awayTeam.logoUrl
      };
      if (!isEligibleSeasonGame(game)) continue;

      const lockTime = getGameLockTime(commenceTime);
      const row = {
        id: existing?.id || existingByEspnId.get(event.id) || event.id,
        espn_event_id: event.id,
        week: getFootballWeek(commenceTime),
        league,
        commence_time: commenceTime,
        home_team: event.homeTeam.displayName,
        away_team: event.awayTeam.displayName,
        home_logo_url: event.homeTeam.logoUrl,
        away_logo_url: event.awayTeam.logoUrl,
        home_rank: league === "CFB" ? espnRankForLogo(rankMap, event.homeTeam.logoUrl) : null,
        away_rank: league === "CFB" ? espnRankForLogo(rankMap, event.awayTeam.logoUrl) : null,
        current_spread_team: providerSpread ? event.awayTeam.displayName : existing?.current_spread_team ?? null,
        current_spread: providerSpread ? providerSpread.awayPoint : existing?.current_spread ?? null,
        current_bookmaker: providerSpread ? "DraftKings" : existing?.current_bookmaker ?? null,
        lock_time: lockTime.toISOString(),
        is_locked: now >= lockTime,
        updated_at: now.toISOString()
      };
      rows.push(row);
      rowByMatchup.set(matchupIdentityKey(league, row.away_team, row.home_team), row);
    }
  }

  let actionGamesDiscovered = 0;
  for (const league of ["CFB", "NFL"] as League[]) {
    const actionSchedule = actionSchedules.get(league) || [];
    for (const actionGame of actionSchedule) {
      if (matchedActionIds.has(actionGame.actionId)) continue;
      const resolveTeam = (name: string, aliases: string[]) => {
        for (const key of teamIdentityKeys(league, [name, ...aliases])) {
          const identity = teamIdentityMap.get(`${league}:${key}`);
          if (identity) return identity;
        }
        return null;
      };

      const awayIdentity = resolveTeam(actionGame.awayTeam, actionGame.awayAliases);
      const homeIdentity = resolveTeam(actionGame.homeTeam, actionGame.homeAliases);
      if (league === "CFB" && (!awayIdentity || !homeIdentity)) continue;

      const awayTeam = awayIdentity?.name || actionGame.awayTeam;
      const homeTeam = homeIdentity?.name || actionGame.homeTeam;
      const matchupKey = matchupIdentityKey(league, awayTeam, homeTeam);
      if (rowByMatchup.has(matchupKey)) continue;

      const existing = existingByMatchup.get(matchupKey);
      const game = {
        league,
        commence_time: actionGame.commenceTime,
        home_team: homeTeam,
        away_team: awayTeam,
        home_logo_url: homeIdentity?.logo || null,
        away_logo_url: awayIdentity?.logo || null
      };
      if (!isEligibleSeasonGame(game)) continue;

      const lockTime = getGameLockTime(actionGame.commenceTime);
      const spread = actionGame.spread && !actionGame.spread.suspended ? actionGame.spread : null;
      const row = {
        id: existing?.id || `action-${league.toLowerCase()}-${actionGame.actionId}`,
        espn_event_id: existing?.espn_event_id || null,
        week: getFootballWeek(actionGame.commenceTime),
        league,
        commence_time: actionGame.commenceTime,
        home_team: homeTeam,
        away_team: awayTeam,
        home_logo_url: homeIdentity?.logo || null,
        away_logo_url: awayIdentity?.logo || null,
        home_rank: league === "CFB" ? espnRankForLogo(rankMap, homeIdentity?.logo || null) : null,
        away_rank: league === "CFB" ? espnRankForLogo(rankMap, awayIdentity?.logo || null) : null,
        current_spread_team: spread ? awayTeam : existing?.current_spread_team || null,
        current_spread: spread ? spread.awayPoint : existing?.current_spread ?? null,
        current_bookmaker: spread ? "DraftKings" : existing?.current_bookmaker || null,
        lock_time: lockTime.toISOString(),
        is_locked: now >= lockTime,
        updated_at: now.toISOString()
      };
      rows.push(row);
      rowByMatchup.set(matchupKey, row);
      actionGamesDiscovered += 1;
    }
  }

  if (rows.length) {
    const { error } = await supabase.from("games").upsert(rows, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }

  return { gamesDiscovered: rows.length, actionGamesDiscovered, start: start.toISOString(), end: end.toISOString() };
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
      current_bookmaker: "DraftKings",
      updated_at: now.toISOString()
    };
    changedGames.push(changed);
    snapshots.push({
      game_id: game.id,
      league: game.league,
      spread_team: game.away_team,
      spread: nextAwaySpread,
      bookmaker: "DraftKings",
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
