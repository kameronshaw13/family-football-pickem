import type { SupabaseClient } from "@supabase/supabase-js";
import { toZonedTime } from "date-fns-tz";
import { isGameAllowedByRules } from "@/lib/groupContext";
import { getGameLockTime, getFootballWeek } from "@/lib/lockRules";
import { isEligibleSeasonGame } from "@/lib/seasonRules";
import { getWeekRule } from "@/lib/weekRules";

export type FinalizeIncompleteCardsResult = {
  groupsChecked: number;
  cardsFinalized: number;
  regularAutoLosses: number;
  missingDogs: number;
};

function configuredWeekRule(rules: any, week: number) {
  const fallback = getWeekRule(week);
  const pickRules = rules?.pickRules || {};
  const configured = pickRules.weekOverrides?.[String(week)] || pickRules.default || {};
  return {
    regularTotal: Number.isFinite(Number(configured.regularTotal)) ? Number(configured.regularTotal) : fallback.regularTotal,
    underdogTotal: Number.isFinite(Number(configured.underdogTotal)) ? Number(configured.underdogTotal) : fallback.underdogTotal
  };
}

function safeIdPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function isWeekendGame(commenceTime: string, timezone: string) {
  const day = toZonedTime(new Date(commenceTime), timezone).getDay();
  return day === 6 || day === 0 || day === 1;
}

async function finalizeGroupWeek(
  supabase: SupabaseClient,
  season: any,
  timezone: string,
  week: number,
  currentTime: Date
) {
  const [{ data: memberships, error: memberError }, { data: games, error: gameError }, { data: picks, error: pickError }] = await Promise.all([
    supabase.from("group_members")
      .select("profile_id")
      .eq("group_id", season.group_id)
      .eq("status", "active"),
    supabase.from("games")
      .select("id,week,league,commence_time,home_team,away_team,current_spread_team,current_spread")
      .eq("week", week),
    supabase.from("picks")
      .select("user_id,pick_type")
      .eq("group_id", season.group_id)
      .eq("season_year", season.season_year)
      .eq("week", week)
  ]);
  if (memberError) throw new Error(memberError.message);
  if (gameError) throw new Error(gameError.message);
  if (pickError) throw new Error(pickError.message);

  const pickableWeekendGames = (games || []).filter((game: any) =>
    game.current_spread_team != null &&
    game.current_spread != null &&
    isWeekendGame(game.commence_time, timezone) &&
    isEligibleSeasonGame(game) &&
    isGameAllowedByRules(season.rules || {}, game)
  );
  if (!pickableWeekendGames.length) return { cardsFinalized: 0, regularAutoLosses: 0, missingDogs: 0 };

  const weekendLock = pickableWeekendGames
    .map((game: any) => getGameLockTime(game.commence_time, timezone))
    .sort((a: Date, b: Date) => a.getTime() - b.getTime())[0];
  if (!weekendLock || currentTime < weekendLock) return { cardsFinalized: 0, regularAutoLosses: 0, missingDogs: 0 };

  const rule = configuredWeekRule(season.rules, week);
  const memberIds = (memberships || []).map((row: any) => row.profile_id).filter(Boolean);
  const counts = new Map<string, { regular: number; dog: number }>();
  for (const memberId of memberIds) counts.set(memberId, { regular: 0, dog: 0 });
  for (const pick of picks || []) {
    const count = counts.get(pick.user_id);
    if (!count) continue;
    if (pick.pick_type === "regular") count.regular += 1;
    if (pick.pick_type === "underdog") count.dog += 1;
  }

  const missingByMember = memberIds.map((userId: string) => {
    const count = counts.get(userId) || { regular: 0, dog: 0 };
    return {
      userId,
      regular: Math.max(0, rule.regularTotal - count.regular),
      dog: Math.max(0, rule.underdogTotal - count.dog)
    };
  }).filter((row: any) => row.regular > 0 || row.dog > 0);
  if (!missingByMember.length) return { cardsFinalized: 0, regularAutoLosses: 0, missingDogs: 0 };

  const maxRegularMissing = Math.max(0, ...missingByMember.map((row: any) => row.regular));
  const maxDogMissing = Math.max(0, ...missingByMember.map((row: any) => row.dog));
  const idBase = `admin-${safeIdPart(season.group_id)}-${season.season_year}-w${week}`;
  const adminGames: any[] = [];
  for (let slot = 1; slot <= maxRegularMissing; slot += 1) {
    adminGames.push({
      id: `${idBase}-missing-regular-${slot}`,
      week,
      league: "CFB",
      commence_time: weekendLock.toISOString(),
      home_team: "Automatic Loss",
      away_team: "No Pick Submitted",
      current_spread_team: null,
      current_spread: null,
      current_bookmaker: "Administrative",
      lock_time: weekendLock.toISOString(),
      is_locked: true,
      final_home_score: 0,
      final_away_score: 0,
      updated_at: currentTime.toISOString()
    });
  }
  for (let slot = 1; slot <= maxDogMissing; slot += 1) {
    adminGames.push({
      id: `${idBase}-missing-dog-${slot}`,
      week,
      league: "CFB",
      commence_time: weekendLock.toISOString(),
      home_team: "No Bonus",
      away_team: "No Dog Submitted",
      current_spread_team: null,
      current_spread: null,
      current_bookmaker: "Administrative",
      lock_time: weekendLock.toISOString(),
      is_locked: true,
      final_home_score: 0,
      final_away_score: 0,
      updated_at: currentTime.toISOString()
    });
  }
  if (adminGames.length) {
    const { error } = await supabase.from("games").upsert(adminGames, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }

  const adminPicks: any[] = [];
  for (const missing of missingByMember) {
    for (let slot = 1; slot <= missing.regular; slot += 1) {
      adminPicks.push({
        user_id: missing.userId,
        game_id: `${idBase}-missing-regular-${slot}`,
        week,
        selected_team: "No Pick Submitted",
        status: "locked",
        locked_spread: null,
        locked_spread_team: null,
        locked_at: weekendLock.toISOString(),
        result: "loss",
        pick_type: "regular",
        underdog_win_value: null,
        group_id: season.group_id,
        season_year: Number(season.season_year),
        updated_at: currentTime.toISOString()
      });
    }
    for (let slot = 1; slot <= missing.dog; slot += 1) {
      adminPicks.push({
        user_id: missing.userId,
        game_id: `${idBase}-missing-dog-${slot}`,
        week,
        selected_team: "No Dog Submitted",
        status: "locked",
        locked_spread: null,
        locked_spread_team: null,
        locked_at: weekendLock.toISOString(),
        result: "loss",
        pick_type: "underdog",
        underdog_win_value: null,
        group_id: season.group_id,
        season_year: Number(season.season_year),
        updated_at: currentTime.toISOString()
      });
    }
  }
  if (adminPicks.length) {
    const { error } = await supabase.from("picks").upsert(adminPicks, { onConflict: "group_id,user_id,game_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  return {
    cardsFinalized: missingByMember.length,
    regularAutoLosses: missingByMember.reduce((sum: number, row: any) => sum + row.regular, 0),
    missingDogs: missingByMember.reduce((sum: number, row: any) => sum + row.dog, 0)
  };
}

export async function finalizeIncompleteCardsAfterWeekendLock(
  supabase: SupabaseClient,
  options: { groupId?: string; seasonYear?: number; week?: number; currentTime?: Date } = {}
): Promise<FinalizeIncompleteCardsResult> {
  const currentTime = options.currentTime || new Date();
  let seasonQuery = supabase.from("group_seasons")
    .select("group_id,season_year,status,rules,group:pickem_groups(timezone)")
    .eq("status", "active");
  if (options.groupId) seasonQuery = seasonQuery.eq("group_id", options.groupId);
  if (options.seasonYear != null) seasonQuery = seasonQuery.eq("season_year", options.seasonYear);
  const { data: seasons, error } = await seasonQuery;
  if (error) throw new Error(error.message);

  const total: FinalizeIncompleteCardsResult = { groupsChecked: 0, cardsFinalized: 0, regularAutoLosses: 0, missingDogs: 0 };
  for (const season of seasons || []) {
    const group = Array.isArray((season as any).group) ? (season as any).group[0] : (season as any).group;
    const timezone = group?.timezone || "America/Chicago";
    const week = options.week ?? getFootballWeek(currentTime.toISOString(), timezone);
    const result = await finalizeGroupWeek(supabase, season, timezone, week, currentTime);
    total.groupsChecked += 1;
    total.cardsFinalized += result.cardsFinalized;
    total.regularAutoLosses += result.regularAutoLosses;
    total.missingDogs += result.missingDogs;
  }
  return total;
}
