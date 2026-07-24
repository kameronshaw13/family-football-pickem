import type { SupabaseClient } from "@supabase/supabase-js";
import type { Game } from "@/lib/types";
import { settleWeekIfReady } from "@/lib/autoSettlement";
import { gradeAgainstSpread, gradeUnderdogOutright } from "@/lib/spreads";

export async function finalizeGame(supabase: SupabaseClient, game: Game, homeScore: number, awayScore: number, settleWeek = true) {
  const updatedAt = new Date().toISOString();
  const { error: gameError } = await supabase
    .from("games")
    .update({ final_home_score: homeScore, final_away_score: awayScore, updated_at: updatedAt })
    .eq("id", game.id);
  if (gameError) throw new Error(gameError.message);

  const { data: picks, error: pickError } = await supabase
    .from("picks")
    .select("*")
    .eq("game_id", game.id)
    .eq("status", "locked");
  if (pickError) throw new Error(pickError.message);

  let picksGraded = 0;
  for (const pick of picks || []) {
    let result: "win" | "loss" | "push";
    if (pick.pick_type === "underdog") {
      result = gradeUnderdogOutright(pick.selected_team, game.home_team, game.away_team, homeScore, awayScore);
    } else {
      if (pick.locked_spread == null) continue;
      result = gradeAgainstSpread(pick.selected_team, game.home_team, game.away_team, homeScore, awayScore, Number(pick.locked_spread));
    }
    const { error } = await supabase.from("picks").update({ result, updated_at: updatedAt }).eq("id", pick.id);
    if (error) throw new Error(error.message);
    picksGraded++;
  }

  const { data: sideBets, error: sideBetError } = await supabase
    .from("side_bets")
    .select("*")
    .eq("game_id", game.id)
    .eq("status", "accepted");
  if (sideBetError) throw new Error(sideBetError.message);

  let sideBetsGraded = 0;
  for (const sideBet of sideBets || []) {
    if (!sideBet.accepted_by) continue;
    const result = gradeAgainstSpread(sideBet.creator_team, game.home_team, game.away_team, homeScore, awayScore, Number(sideBet.creator_spread));
    const sideBetResult = result === "win" ? "creator_win" : result === "loss" ? "acceptor_win" : "push";
    const winnerId = result === "win" ? sideBet.creator_id : result === "loss" ? sideBet.accepted_by : null;
    const { error } = await supabase.from("side_bets").update({
      status: "settled",
      result: sideBetResult,
      winner_id: winnerId,
      updated_at: updatedAt
    }).eq("id", sideBet.id).eq("status", "accepted");
    if (error) throw new Error(error.message);
    sideBetsGraded++;
  }

  const settlement = settleWeek
    ? await settleWeekIfReady(supabase, Number(game.week))
    : { settled: false, reason: "Settlement deferred until the final-score batch is complete." };
  return { picksGraded, sideBetsGraded, settlement };
}
