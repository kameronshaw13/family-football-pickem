import type { SupabaseClient } from "@supabase/supabase-js";
import { finalPickemWeek, footballSeasonYearAt, nflRegularSeasonEnd } from "@/lib/seasonRules";
import { computeWeeklyStandings } from "@/lib/weeklyBank";

const SEASON_ENTRY_OFFSET = 1000;

export type SeasonSettlementResult = {
  settled: boolean;
  reason?: string;
  seasonYear: number;
  winnerId?: string;
};

export async function settleSeasonIfReady(
  supabase: SupabaseClient,
  currentTime = new Date()
): Promise<SeasonSettlementResult> {
  const seasonYear = footballSeasonYearAt(currentTime);
  if (currentTime < nflRegularSeasonEnd(seasonYear)) {
    return { settled: false, reason: "NFL Week 18 is not complete.", seasonYear };
  }

  const [{ data: profiles, error: profilesError }, { data: picks, error: picksError }] = await Promise.all([
    supabase.from("profiles").select("id,display_name").order("display_name", { ascending: true }),
    supabase.from("picks").select("*, game:games(commence_time)")
  ]);
  if (profilesError) throw new Error(profilesError.message);
  if (picksError) throw new Error(picksError.message);
  if ((profiles || []).length !== 3) {
    return { settled: false, reason: "The league must have exactly three players.", seasonYear };
  }

  const seasonPicks = (picks || []).filter((pick: any) =>
    pick.game?.commence_time &&
    footballSeasonYearAt(new Date(pick.game.commence_time)) === seasonYear
  );
  const finalWeek = finalPickemWeek(seasonYear);
  if (seasonPicks.some((pick: any) =>
    Number(pick.week) === finalWeek &&
    (pick.status !== "locked" || pick.result === "pending")
  )) {
    return { settled: false, reason: "At least one final-week pick is unfinished.", seasonYear };
  }

  const standings = computeWeeklyStandings(profiles || [], seasonPicks);
  if (standings.length !== 3 || standings[0].rank === standings[1].rank) {
    return { settled: false, reason: "Season standings are tied for first.", seasonYear };
  }

  const winner = standings[0];
  const entryWeek = SEASON_ENTRY_OFFSET + seasonYear;
  const entries = standings.map((row) => ({
    week: entryWeek,
    user_id: row.user_id,
    amount: row.user_id === winner.user_id ? 300 : -150,
    note: row.user_id === winner.user_id
      ? `${seasonYear} season champion`
      : `${seasonYear} season entry`
  }));

  const { error } = await supabase
    .from("bank_entries")
    .upsert(entries, { onConflict: "week,user_id" });
  if (error) throw new Error(error.message);

  return { settled: true, seasonYear, winnerId: winner.user_id };
}
