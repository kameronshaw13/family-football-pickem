import type { SupabaseClient } from "@supabase/supabase-js";
import { getGameLockTime } from "@/lib/lockRules";
import { hasChargers, isChargersTeam } from "@/lib/seasonRules";
import { normalizeSpreadForSelectedTeam, underdogWinValue } from "@/lib/spreads";

export type LockDuePicksResult = {
  gamesLocked: number;
  picksLocked: number;
  picksRemoved: number;
};

export async function lockDuePicks(
  supabase: SupabaseClient,
  currentTime = new Date()
): Promise<LockDuePicksResult> {
  const now = currentTime.toISOString();
  const { data: games, error: gameError } = await supabase
    .from("games")
    .select("*")
    .eq("is_locked", false);
  if (gameError) throw new Error(gameError.message);

  let gamesLocked = 0;
  let picksLocked = 0;
  let picksRemoved = 0;

  for (const game of games || []) {
    const effectiveLockTime = getGameLockTime(game.commence_time);
    const effectiveLockTimeIso = effectiveLockTime.toISOString();
    if (effectiveLockTime > currentTime) {
      if (game.lock_time !== effectiveLockTimeIso) {
        const { error } = await supabase
          .from("games")
          .update({ lock_time: effectiveLockTimeIso, updated_at: now })
          .eq("id", game.id);
        if (error) throw new Error(error.message);
      }
      continue;
    }

    const { error: updateGameError } = await supabase
      .from("games")
      .update({ is_locked: true, lock_time: effectiveLockTimeIso, updated_at: now })
      .eq("id", game.id);
    if (updateGameError) throw new Error(updateGameError.message);
    gamesLocked++;

    const { data: draftPicks, error: pickError } = await supabase
      .from("picks")
      .select("*")
      .eq("game_id", game.id)
      .eq("status", "draft");
    if (pickError) throw new Error(pickError.message);

    for (const pick of draftPicks || []) {
      if (hasChargers(game) || isChargersTeam(pick.selected_team)) {
        const { error } = await supabase
          .from("picks")
          .delete()
          .eq("id", pick.id)
          .eq("status", "draft");
        if (error) throw new Error(error.message);
        picksRemoved++;
        continue;
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
      picksLocked++;
    }
  }

  return { gamesLocked, picksLocked, picksRemoved };
}
