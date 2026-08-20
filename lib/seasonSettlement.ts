import type { SupabaseClient } from "@supabase/supabase-js";
import { computeGroupStandings, rankedPayoutSettlement, winnerTakeAllSettlement } from "@/lib/groupScoring";
import { finalPickemWeek, footballSeasonYearAt, nflRegularSeasonEnd } from "@/lib/seasonRules";

const SEASON_ENTRY_OFFSET = 1000;
export type SeasonSettlementResult = { settled: boolean; reason?: string; seasonYear: number; winnerId?: string; groupsSettled?: string[] };

export async function settleSeasonIfReady(supabase: SupabaseClient, currentTime = new Date()): Promise<SeasonSettlementResult> {
  const seasonYear = footballSeasonYearAt(currentTime);
  if (currentTime < nflRegularSeasonEnd(seasonYear)) return { settled: false, reason: "NFL Week 18 is not complete.", seasonYear };

  const { data: seasons, error: seasonError } = await supabase.from("group_seasons").select("group_id,season_year,rules").eq("season_year", seasonYear).eq("status", "active");
  if (seasonError) throw new Error(seasonError.message);
  if (!seasons?.length) return { settled: false, reason: "No active groups are configured for this season.", seasonYear };

  const settledGroups: string[] = [];
  let firstWinnerId: string | undefined;
  let lastReason = "No group is ready for season settlement.";

  for (const season of seasons) {
    const [{ data: memberships, error: memberError }, { data: picks, error: pickError }] = await Promise.all([
      supabase.from("group_members").select("profile:profiles(id,display_name)").eq("group_id", season.group_id).eq("status", "active"),
      supabase.from("picks").select("*, game:games(commence_time)").eq("group_id", season.group_id).eq("season_year", seasonYear)
    ]);
    if (memberError) throw new Error(memberError.message);
    if (pickError) throw new Error(pickError.message);
    const profiles = (memberships || []).flatMap((row: any) => {
      const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
      return profile ? [profile] : [];
    });
    if (profiles.length < 2) { lastReason = "A group needs at least two active players."; continue; }
    const seasonPicks = (picks || []).filter((pick: any) => pick.game?.commence_time && footballSeasonYearAt(new Date(pick.game.commence_time)) === seasonYear);
    const finalWeek = finalPickemWeek(seasonYear);
    if (seasonPicks.some((pick: any) => Number(pick.week) === finalWeek && (pick.status !== "locked" || pick.result === "pending"))) {
      lastReason = "At least one final-week pick is unfinished.";
      continue;
    }

    const standings = computeGroupStandings(profiles, seasonPicks as any, season.rules);
    const prizeRules = season.rules?.seasonPrizes || {};
    const mode = prizeRules.mode || "shaw";
    let settlement: { amounts: Map<string, number>; notes: Map<string, string> };

    if (mode === "winner_take_all") {
      const { data: moneyRow, error: moneyError } = await supabase.from("group_season_money")
        .select("winner_take_all_amount,submitted_at")
        .eq("group_id", season.group_id)
        .eq("season_year", seasonYear)
        .maybeSingle();
      if (moneyError) throw new Error(moneyError.message);
      if (!moneyRow?.submitted_at) {
        lastReason = "The season winner-take-all pot has not been submitted.";
        continue;
      }
      settlement = winnerTakeAllSettlement(standings, Number(moneyRow?.winner_take_all_amount || 0));
    } else if (mode === "friends_season") {
      const payouts = standings.map((_, index) => {
        if (index === 0) return Number(prizeRules.first ?? 150);
        if (index === 1) return Number(prizeRules.second ?? 50);
        if (index === 2) return Number(prizeRules.third ?? -30);
        if (index === 3) return Number(prizeRules.fourth ?? -70);
        return Number(prizeRules.fifth ?? -100);
      });
      settlement = rankedPayoutSettlement(standings, payouts, `${seasonYear} season payout`);
    } else {
      if (standings.length < 2 || standings[0].rank === standings[1].rank) {
        lastReason = "Season standings have an unresolved first-place tie.";
        continue;
      }
      const winner = standings[0];
      const secondRank = standings.find((row) => row.rank > winner.rank)?.rank;
      const second = secondRank == null ? null : standings.find((row) => row.rank === secondRank) || null;
      const last = standings[standings.length - 1];
      const lastTied = standings.filter((row) => row.rank === last.rank).length > 1;
      if (!second || lastTied) {
        lastReason = "Season prize positions have an unresolved tie.";
        continue;
      }
      const firstAmount = Number(prizeRules.first ?? 300);
      const secondAmount = Number(prizeRules.second ?? -100);
      const lastAmount = Number(prizeRules.last ?? -200);
      settlement = {
        amounts: new Map(standings.map((row) => [row.user_id, row.user_id === winner.user_id ? firstAmount : row.user_id === second.user_id ? secondAmount : row.user_id === last.user_id ? lastAmount : 0])),
        notes: new Map(standings.map((row) => [row.user_id, row.user_id === winner.user_id ? `${seasonYear} season champion` : row.user_id === second.user_id ? `${seasonYear} season second place` : row.user_id === last.user_id ? `${seasonYear} season last place` : `${seasonYear} season`]))
      };
    }

    const entryWeek = SEASON_ENTRY_OFFSET + seasonYear;
    const entries = standings.map((row) => ({
      group_id: season.group_id,
      season_year: seasonYear,
      week: entryWeek,
      user_id: row.user_id,
      amount: settlement.amounts.get(row.user_id) || 0,
      note: settlement.notes.get(row.user_id) || `${seasonYear} season`
    }));
    const firstRank = standings[0]?.rank;
    const results = standings.map((row) => ({
      group_id: season.group_id,
      season_year: seasonYear,
      profile_id: row.user_id,
      final_rank: row.rank,
      wins: row.wins,
      losses: row.losses,
      pushes: row.pushes,
      points: row.points ?? null,
      is_champion: row.rank === firstRank,
      finalized_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
    const [bankWrite, resultWrite] = await Promise.all([
      supabase.from("bank_entries").upsert(entries, { onConflict: "group_id,season_year,week,user_id" }),
      supabase.from("group_season_results").upsert(results, { onConflict: "group_id,season_year,profile_id" })
    ]);
    if (bankWrite.error) throw new Error(bankWrite.error.message);
    if (resultWrite.error) throw new Error(resultWrite.error.message);
    settledGroups.push(season.group_id);
    firstWinnerId ||= standings[0]?.user_id;
  }

  return settledGroups.length ? { settled: true, seasonYear, winnerId: firstWinnerId, groupsSettled: settledGroups } : { settled: false, reason: lastReason, seasonYear, groupsSettled: [] };
}
