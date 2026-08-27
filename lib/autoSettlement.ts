import type { SupabaseClient } from "@supabase/supabase-js";
import { computeGroupStandings, rankedPayoutSettlement, winnerTakeAllSettlement } from "@/lib/groupScoring";
import { computeWeeklySettlement } from "@/lib/weeklyBank";
import { getWeekRule } from "@/lib/weekRules";

export type AutoSettlementResult = {
  settled: boolean;
  reason?: string;
  perfect?: boolean;
  entries?: Array<{ group_id: string; season_year: number; week: number; user_id: string; amount: number; note: string }>;
  groupsSettled?: string[];
};

function configuredWeekRule(rules: any, week: number) {
  const fallback = getWeekRule(week);
  const pickRules = rules?.pickRules || {};
  const configured = pickRules.weekOverrides?.[String(week)] || pickRules.default || {};
  return {
    ...fallback,
    regularTotal: Number.isFinite(Number(configured.regularTotal)) ? Number(configured.regularTotal) : fallback.regularTotal,
    underdogTotal: Number.isFinite(Number(configured.underdogTotal)) ? Number(configured.underdogTotal) : fallback.underdogTotal,
    perfectBonus: typeof configured.perfectBonus === "boolean" ? configured.perfectBonus : fallback.perfectBonus
  };
}

export async function settleWeekIfReady(supabase: SupabaseClient, week: number, groupId?: string): Promise<AutoSettlementResult> {
  let seasonQuery = supabase.from("group_seasons").select("group_id,season_year,status,rules").eq("status", "active");
  if (groupId) seasonQuery = seasonQuery.eq("group_id", groupId);
  const { data: seasons, error: seasonError } = await seasonQuery;
  if (seasonError) throw new Error(seasonError.message);
  if (!seasons?.length) return { settled: false, reason: "No active Pick'em season is configured." };

  const allEntries: Array<{ group_id: string; season_year: number; week: number; user_id: string; amount: number; note: string }> = [];
  const groupsSettled: string[] = [];
  let lastReason = "The week is not ready to settle.";
  let anyPerfect = false;

  for (const season of seasons) {
    const [{ data: memberships, error: memberError }, { data: picks, error: picksError }] = await Promise.all([
      supabase.from("group_members").select("profile:profiles(id,display_name)").eq("group_id", season.group_id).eq("status", "active"),
      supabase.from("picks").select("*").eq("group_id", season.group_id).eq("season_year", season.season_year).eq("week", week)
    ]);
    if (memberError) throw new Error(memberError.message);
    if (picksError) throw new Error(picksError.message);
    const profiles = (memberships || []).flatMap((row: any) => {
      const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
      return profile ? [profile] : [];
    });
    if (profiles.length < 2) { lastReason = "The group needs at least two active players."; continue; }

    const rule = configuredWeekRule(season.rules, week);
    let ready = true;
    for (const profile of profiles) {
      const card = (picks || []).filter((pick: any) => pick.user_id === profile.id);
      const regularCount = card.filter((pick: any) => pick.pick_type === "regular").length;
      const dogCount = card.filter((pick: any) => pick.pick_type === "underdog").length;
      if (regularCount !== rule.regularTotal || dogCount !== rule.underdogTotal) {
        lastReason = `${profile.display_name}'s card is incomplete.`;
        ready = false;
        break;
      }
      if (card.some((pick: any) => pick.status !== "locked" || pick.result === "pending")) {
        lastReason = "At least one card still has an unfinished game.";
        ready = false;
        break;
      }
    }
    if (!ready) continue;

    const standings = computeGroupStandings(profiles, (picks || []) as any, season.rules);
    const bankRules = season.rules?.weeklyBank || {};
    let settlement: { amounts: Map<string, number>; notes: Map<string, string>; perfect?: boolean };

    if (bankRules.mode === "winner_take_all") {
      const { data: moneyRow, error: moneyError } = await supabase.from("group_week_money")
        .select("winner_take_all_amount,submitted_at")
        .eq("group_id", season.group_id)
        .eq("season_year", season.season_year)
        .eq("week", week)
        .maybeSingle();
      if (moneyError) throw new Error(moneyError.message);
      if (!moneyRow?.submitted_at) {
        lastReason = `The Week ${week} winner-take-all pot has not been submitted.`;
        continue;
      }
      settlement = winnerTakeAllSettlement(standings, Number(moneyRow?.winner_take_all_amount || 0));
    } else if (bankRules.mode === "friends_weekly") {
      const perfect = rule.perfectBonus && standings[0]?.losses === 0 && standings[0]?.wins >= 5;
      const configuredPerfectMultiplier = Number(bankRules.perfectMultiplier ?? 1.5);
      const perfectMultiplier = Number.isFinite(configuredPerfectMultiplier) && configuredPerfectMultiplier > 0
        ? configuredPerfectMultiplier
        : 1.5;
      const multiplier = perfect ? perfectMultiplier : 1;
      const configuredPayouts = [
        Number(bankRules.first ?? bankRules.winner ?? 40),
        Number(bankRules.second ?? 20),
        Number(bankRules.third ?? 0),
        Number(bankRules.fourth ?? 0),
        Number(bankRules.fifth ?? 0),
        Number(bankRules.sixth ?? -10),
        Number(bankRules.seventh ?? -20),
        Number(bankRules.eighth ?? -30)
      ];
      const payouts = standings.map((_, index) => Number(configuredPayouts[index] ?? 0) * multiplier);
      settlement = { ...rankedPayoutSettlement(standings, payouts, `Week ${week} payout${perfect ? " · perfect week" : ""}`), perfect };
      anyPerfect ||= perfect;
    } else {
      const shaw = computeWeeklySettlement(standings, rule.perfectBonus);
      settlement = shaw;
      anyPerfect ||= shaw.perfect;
    }

    const entries = profiles.map((profile: any) => ({
      group_id: season.group_id,
      season_year: Number(season.season_year),
      week,
      user_id: profile.id,
      amount: settlement.amounts.get(profile.id) || 0,
      note: settlement.notes.get(profile.id) || `Week ${week} settlement`
    }));
    const { error: upsertError } = await supabase.from("bank_entries").upsert(entries, { onConflict: "group_id,season_year,week,user_id" });
    if (upsertError) throw new Error(upsertError.message);
    allEntries.push(...entries);
    groupsSettled.push(season.group_id);
  }

  return groupsSettled.length
    ? { settled: true, perfect: anyPerfect, entries: allEntries, groupsSettled }
    : { settled: false, reason: lastReason, groupsSettled: [] };
}
