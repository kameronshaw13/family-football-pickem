import type { SupabaseClient } from "@supabase/supabase-js";
import type { Game } from "@/lib/types";
import { settleWeekIfReady } from "@/lib/autoSettlement";
import { gradeAgainstSpread, gradeUnderdogOutright } from "@/lib/spreads";
import { createNotificationSafely } from "@/lib/notifications";

async function groupInfo(supabase: SupabaseClient, groupId: string, cache: Map<string, { slug: string; members: Array<{ id: string; display_name: string }> }>) {
  const cached = cache.get(groupId);
  if (cached) return cached;
  const [{ data: group, error: groupError }, { data: memberships, error: memberError }] = await Promise.all([
    supabase.from("pickem_groups").select("slug").eq("id", groupId).single(),
    supabase.from("group_members").select("profile:profiles(id,display_name)").eq("group_id", groupId).eq("status", "active")
  ]);
  if (groupError) throw new Error(groupError.message);
  if (memberError) throw new Error(memberError.message);
  const members = (memberships || []).flatMap((row: any) => {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    return profile ? [profile] : [];
  });
  const info = { slug: group.slug as string, members };
  cache.set(groupId, info);
  return info;
}

export async function finalizeGame(supabase: SupabaseClient, game: Game, homeScore: number, awayScore: number, settleWeek = true) {
  const updatedAt = new Date().toISOString();
  const gameResult = await supabase.from("games").update({ final_home_score: homeScore, final_away_score: awayScore, updated_at: updatedAt }).eq("id", game.id);
  if (gameResult.error) throw new Error(gameResult.error.message);

  const { data: picks, error: pickError } = await supabase.from("picks").select("*, profile:profiles(id,display_name)").eq("game_id", game.id).eq("status", "locked");
  if (pickError) throw new Error(pickError.message);
  const groupCache = new Map<string, { slug: string; members: Array<{ id: string; display_name: string }> }>();
  let picksGraded = 0;
  const notificationTasks: Array<Promise<unknown>> = [];

  for (const pick of picks || []) {
    let result: "win" | "loss" | "push";
    if (pick.pick_type === "underdog") result = gradeUnderdogOutright(pick.selected_team, game.home_team, game.away_team, homeScore, awayScore);
    else {
      if (pick.locked_spread == null) continue;
      result = gradeAgainstSpread(pick.selected_team, game.home_team, game.away_team, homeScore, awayScore, Number(pick.locked_spread));
    }
    const update = await supabase.from("picks").update({ result, updated_at: updatedAt }).eq("id", pick.id);
    if (update.error) throw new Error(update.error.message);
    picksGraded++;

    const group = await groupInfo(supabase, pick.group_id, groupCache);
    const resultLabel = result === "win" ? "Won" : result === "loss" ? "Lost" : "Pushed";
    const score = `${game.away_team} ${awayScore}, ${game.home_team} ${homeScore}`;
    notificationTasks.push(createNotificationSafely(supabase, { groupId: pick.group_id, userId: pick.user_id, type: "pick_final", destination: "my_card", entityId: pick.id, dedupeKey: `pick-final:${pick.id}`, title: `Your ${pick.selected_team} pick is final`, body: `${resultLabel} · ${score}`, url: `/?group=${group.slug}&notification=my_card` }));
    const owner = Array.isArray(pick.profile) ? pick.profile[0] : pick.profile;
    for (const recipient of group.members) {
      if (recipient.id === pick.user_id) continue;
      notificationTasks.push(createNotificationSafely(supabase, { groupId: pick.group_id, userId: recipient.id, type: "league_pick_final", destination: "league_cards", entityId: pick.id, dedupeKey: `league-pick-final:${pick.id}`, title: `${owner?.display_name || "A player"}'s pick is final`, body: `${pick.selected_team} · ${resultLabel} · ${score}`, url: `/?group=${group.slug}&notification=league_cards` }));
    }
  }

  const { data: sideBets, error: sideBetError } = await supabase.from("side_bets").select("*").eq("game_id", game.id).eq("status", "accepted");
  if (sideBetError) throw new Error(sideBetError.message);
  let sideBetsGraded = 0;
  for (const sideBet of sideBets || []) {
    if (!sideBet.accepted_by) continue;
    const result = gradeAgainstSpread(sideBet.creator_team, game.home_team, game.away_team, homeScore, awayScore, Number(sideBet.creator_spread));
    const sideBetResult = result === "win" ? "creator_win" : result === "loss" ? "acceptor_win" : "push";
    const winnerId = result === "win" ? sideBet.creator_id : result === "loss" ? sideBet.accepted_by : null;
    const update = await supabase.from("side_bets").update({ status: "settled", result: sideBetResult, winner_id: winnerId, updated_at: updatedAt }).eq("id", sideBet.id).eq("group_id", sideBet.group_id).eq("status", "accepted");
    if (update.error) throw new Error(update.error.message);
    sideBetsGraded++;
    const group = await groupInfo(supabase, sideBet.group_id, groupCache);
    const score = `${game.away_team} ${awayScore}, ${game.home_team} ${homeScore}`;
    const creatorResult = result === "win" ? "Won" : result === "loss" ? "Lost" : "Pushed";
    const acceptorResult = result === "loss" ? "Won" : result === "win" ? "Lost" : "Pushed";
    notificationTasks.push(createNotificationSafely(supabase, { groupId: sideBet.group_id, userId: sideBet.creator_id, type: "side_bet_final", destination: "side_bet_ledger", entityId: sideBet.id, dedupeKey: `side-bet-final:${sideBet.id}`, title: "Your side bet is final", body: `${creatorResult} $${Number(sideBet.amount)} · ${score}`, url: `/?group=${group.slug}&notification=side_bet_ledger` }));
    notificationTasks.push(createNotificationSafely(supabase, { groupId: sideBet.group_id, userId: sideBet.accepted_by, type: "side_bet_final", destination: "side_bet_ledger", entityId: sideBet.id, dedupeKey: `side-bet-final:${sideBet.id}`, title: "Your side bet is final", body: `${acceptorResult} $${Number(sideBet.amount)} · ${score}`, url: `/?group=${group.slug}&notification=side_bet_ledger` }));
  }

  await Promise.all(notificationTasks);
  const settlement = settleWeek ? await settleWeekIfReady(supabase, Number(game.week)) : { settled: false, reason: "Settlement deferred until the final-score batch is complete." };
  return { picksGraded, sideBetsGraded, settlement };
}
