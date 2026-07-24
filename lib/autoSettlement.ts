import type { SupabaseClient } from "@supabase/supabase-js";
import { computeWeeklySettlement, computeWeeklyStandings } from "@/lib/weeklyBank";
import { getWeekRule } from "@/lib/weekRules";

export type AutoSettlementResult = {
  settled: boolean;
  reason?: string;
  perfect?: boolean;
  entries?: Array<{ week: number; user_id: string; amount: number; note: string }>;
};

export async function settleWeekIfReady(supabase: SupabaseClient, week: number): Promise<AutoSettlementResult> {
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id,display_name")
    .order("display_name", { ascending: true });
  if (profilesError) throw new Error(profilesError.message);
  if ((profiles || []).length !== 3) return { settled: false, reason: "The league must have exactly three players." };

  const { data: picks, error: picksError } = await supabase
    .from("picks")
    .select("*")
    .eq("week", week);
  if (picksError) throw new Error(picksError.message);

  const rule = getWeekRule(week);
  for (const profile of profiles || []) {
    const card = (picks || []).filter((pick) => pick.user_id === profile.id);
    const regularCount = card.filter((pick) => pick.pick_type === "regular").length;
    const dogCount = card.filter((pick) => pick.pick_type === "underdog").length;
    if (regularCount !== rule.regularTotal || dogCount !== rule.underdogTotal) {
      return { settled: false, reason: `${profile.display_name}'s card is incomplete.` };
    }
    if (card.some((pick) => pick.status !== "locked" || pick.result === "pending")) {
      return { settled: false, reason: "At least one card still has an unfinished game." };
    }
  }

  const standings = computeWeeklyStandings(profiles || [], picks || []);
  const settlement = computeWeeklySettlement(standings, rule.perfectBonus);
  const entries = (profiles || []).map((profile) => ({
    week,
    user_id: profile.id,
    amount: settlement.amounts.get(profile.id) || 0,
    note: settlement.notes.get(profile.id) || `Week ${week} settlement`
  }));

  const { error: upsertError } = await supabase
    .from("bank_entries")
    .upsert(entries, { onConflict: "week,user_id" });
  if (upsertError) throw new Error(upsertError.message);

  return { settled: true, perfect: settlement.perfect, entries };
}
