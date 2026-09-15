import type { SupabaseClient } from "@supabase/supabase-js";
import { getUnderdogBonusForRules, isGameAllowedByRules } from "@/lib/groupContext";
import { getGameLockTime } from "@/lib/lockRules";
import { normalizeSpreadForSelectedTeam } from "@/lib/spreads";

export type LockDuePicksResult = {
  gamesLocked: number;
  picksLocked: number;
  picksRemoved: number;
};

const LOCK_SCAN_HORIZON_MS = 7 * 24 * 60 * 60 * 1000;
const GAME_SELECT = "id,league,commence_time,lock_time,home_team,away_team,current_spread_team,current_spread,is_locked";

export async function lockDuePicks(
  supabase: SupabaseClient,
  currentTime = new Date()
): Promise<LockDuePicksResult> {
  const now = currentTime.toISOString();
  const horizon = new Date(currentTime.getTime() + LOCK_SCAN_HORIZON_MS).toISOString();

  const [{ data: unlockedGames, error: gameError }, { data: draftRows, error: draftError }] = await Promise.all([
    supabase
      .from("games")
      .select(GAME_SELECT)
      .eq("is_locked", false)
      .lte("commence_time", horizon),
    supabase
      .from("picks")
      .select("game_id")
      .eq("status", "draft")
  ]);
  if (gameError) throw new Error(gameError.message);
  if (draftError) throw new Error(draftError.message);

  // Recovery path: an odds refresh used to be able to mark a game locked before
  // this routine locked its draft picks. Include already-locked games that still
  // have draft picks so those picks can never be stranded as pending forever.
  const draftGameIds = Array.from(new Set((draftRows || []).map((row: any) => row.game_id).filter(Boolean)));
  const { data: lockedGamesWithDrafts, error: lockedGameError } = draftGameIds.length
    ? await supabase
        .from("games")
        .select(GAME_SELECT)
        .in("id", draftGameIds)
        .eq("is_locked", true)
        .lte("commence_time", horizon)
    : { data: [], error: null };
  if (lockedGameError) throw new Error(lockedGameError.message);

  const gamesById = new Map<string, any>();
  for (const game of [...(unlockedGames || []), ...(lockedGamesWithDrafts || [])]) gamesById.set(game.id, game);
  const games = Array.from(gamesById.values());

  const results = await Promise.all(games.map(async (game) => {
    const effectiveLockTime = getGameLockTime(game.commence_time);
    const effectiveLockTimeIso = effectiveLockTime.toISOString();

    if (effectiveLockTime > currentTime) {
      if (!game.is_locked && game.lock_time !== effectiveLockTimeIso) {
        const { error } = await supabase
          .from("games")
          .update({ lock_time: effectiveLockTimeIso, updated_at: now })
          .eq("id", game.id)
          .eq("is_locked", false);
        if (error) throw new Error(error.message);
      }
      return { gamesLocked: 0, picksLocked: 0, picksRemoved: 0 };
    }

    let gamesLocked = 0;
    if (!game.is_locked) {
      // Several open phones can hit the live-score route at the same time. Claim
      // the game once, but still continue below even if another request claimed
      // it first so any stranded draft picks are recovered idempotently.
      const { data: claimed, error: updateGameError } = await supabase
        .from("games")
        .update({ is_locked: true, lock_time: effectiveLockTimeIso, updated_at: now })
        .eq("id", game.id)
        .eq("is_locked", false)
        .select("id")
        .maybeSingle();
      if (updateGameError) throw new Error(updateGameError.message);
      gamesLocked = claimed ? 1 : 0;
    }

    const { data: draftPicks, error: pickError } = await supabase
      .from("picks")
      .select("id,selected_team,pick_type,group_id,season_year")
      .eq("game_id", game.id)
      .eq("status", "draft");
    if (pickError) throw new Error(pickError.message);

    const groupIds = Array.from(new Set((draftPicks || []).map((pick: any) => pick.group_id).filter(Boolean)));
    const { data: seasons, error: seasonError } = groupIds.length
      ? await supabase.from("group_seasons").select("group_id,season_year,rules").in("group_id", groupIds)
      : { data: [], error: null };
    if (seasonError) throw new Error(seasonError.message);
    const rulesBySeason = new Map((seasons || []).map((season: any) => [`${season.group_id}:${season.season_year}`, season.rules || {}]));

    const pickResults = await Promise.all((draftPicks || []).map(async (pick) => {
      const rules = rulesBySeason.get(`${pick.group_id}:${pick.season_year}`) || {};
      if (!isGameAllowedByRules(rules, game)) {
        const { data: deleted, error } = await supabase
          .from("picks")
          .delete()
          .eq("id", pick.id)
          .eq("status", "draft")
          .select("id")
          .maybeSingle();
        if (error) throw new Error(error.message);
        return { picksLocked: 0, picksRemoved: deleted ? 1 : 0 };
      }

      const lockedSpread = normalizeSpreadForSelectedTeam(
        pick.selected_team,
        game.current_spread_team,
        game.current_spread
      );
      const dogValue = pick.pick_type === "underdog"
        ? getUnderdogBonusForRules(rules, lockedSpread)
        : null;
      const { data: lockedPick, error } = await supabase
        .from("picks")
        .update({
          status: "locked",
          locked_at: effectiveLockTimeIso,
          locked_spread: lockedSpread,
          locked_spread_team: pick.selected_team,
          underdog_win_value: dogValue,
          updated_at: now
        })
        .eq("id", pick.id)
        .eq("status", "draft")
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return { picksLocked: lockedPick ? 1 : 0, picksRemoved: 0 };
    }));

    return {
      gamesLocked,
      picksLocked: pickResults.reduce((sum, result) => sum + result.picksLocked, 0),
      picksRemoved: pickResults.reduce((sum, result) => sum + result.picksRemoved, 0)
    };
  }));

  return results.reduce<LockDuePicksResult>((total, result) => ({
    gamesLocked: total.gamesLocked + result.gamesLocked,
    picksLocked: total.picksLocked + result.picksLocked,
    picksRemoved: total.picksRemoved + result.picksRemoved
  }), { gamesLocked: 0, picksLocked: 0, picksRemoved: 0 });
}
