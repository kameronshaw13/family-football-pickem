import type { SupabaseClient } from "@supabase/supabase-js";
import { getGameLockTime } from "@/lib/lockRules";
import { hasChargers, isChargersTeam } from "@/lib/seasonRules";
import { normalizeSpreadForSelectedTeam, underdogWinValue } from "@/lib/spreads";

export type LockDuePicksResult = {
  gamesLocked: number;
  picksLocked: number;
  picksRemoved: number;
};

const LOCK_SCAN_HORIZON_MS = 7 * 24 * 60 * 60 * 1000;

export async function lockDuePicks(
  supabase: SupabaseClient,
  currentTime = new Date()
): Promise<LockDuePicksResult> {
  const now = currentTime.toISOString();
  const horizon = new Date(currentTime.getTime() + LOCK_SCAN_HORIZON_MS).toISOString();
  const { data: games, error: gameError } = await supabase
    .from("games")
    .select("id,commence_time,lock_time,home_team,away_team,current_spread_team,current_spread")
    .eq("is_locked", false)
    .lte("commence_time", horizon);
  if (gameError) throw new Error(gameError.message);

  const results = await Promise.all((games || []).map(async (game) => {
    const effectiveLockTime = getGameLockTime(game.commence_time);
    const effectiveLockTimeIso = effectiveLockTime.toISOString();

    if (effectiveLockTime > currentTime) {
      if (game.lock_time !== effectiveLockTimeIso) {
        const { error } = await supabase
          .from("games")
          .update({ lock_time: effectiveLockTimeIso, updated_at: now })
          .eq("id", game.id)
          .eq("is_locked", false);
        if (error) throw new Error(error.message);
      }
      return { gamesLocked: 0, picksLocked: 0, picksRemoved: 0 };
    }

    // Several open phones can hit the live-score route at the same time. Claim
    // the game once so only one request performs the draft-pick locking work.
    const { data: claimed, error: updateGameError } = await supabase
      .from("games")
      .update({ is_locked: true, lock_time: effectiveLockTimeIso, updated_at: now })
      .eq("id", game.id)
      .eq("is_locked", false)
      .select("id")
      .maybeSingle();
    if (updateGameError) throw new Error(updateGameError.message);
    if (!claimed) return { gamesLocked: 0, picksLocked: 0, picksRemoved: 0 };

    const { data: draftPicks, error: pickError } = await supabase
      .from("picks")
      .select("id,selected_team,pick_type")
      .eq("game_id", game.id)
      .eq("status", "draft");
    if (pickError) throw new Error(pickError.message);

    const pickResults = await Promise.all((draftPicks || []).map(async (pick) => {
      if (hasChargers(game) || isChargersTeam(pick.selected_team)) {
        const { error } = await supabase
          .from("picks")
          .delete()
          .eq("id", pick.id)
          .eq("status", "draft");
        if (error) throw new Error(error.message);
        return { picksLocked: 0, picksRemoved: 1 };
      }

      const lockedSpread = normalizeSpreadForSelectedTeam(
        pick.selected_team,
        game.current_spread_team,
        game.current_spread
      );
      const dogValue = pick.pick_type === "underdog"
        ? underdogWinValue(lockedSpread)
        : null;
      const { error } = await supabase
        .from("picks")
        .update({
          status: "locked",
          locked_at: now,
          locked_spread: lockedSpread,
          locked_spread_team: pick.selected_team,
          underdog_win_value: dogValue,
          updated_at: now
        })
        .eq("id", pick.id)
        .eq("status", "draft");
      if (error) throw new Error(error.message);
      return { picksLocked: 1, picksRemoved: 0 };
    }));

    return {
      gamesLocked: 1,
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
