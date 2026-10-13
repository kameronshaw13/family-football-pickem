import { buildBankHistory } from "./bankHistory";
import { availableSideBetFunds, sideBetReservedFunds } from "./sideBetBank";

/**
 * Read current balances and all unsettled exposure from the database for an
 * authoritative side-bet mutation check. Only Friends has cash-bank limits.
 */
export async function getFriendsSideBetFunds(supabase: any, groupId: string, seasonYear: number) {
  const [bankResult, resetsResult] = await Promise.all([
    supabase.from("bank_entries")
      .select("user_id,week,amount")
      .eq("group_id", groupId).eq("season_year", seasonYear),
    supabase.from("bank_resets")
      .select("user_id,week,opening_balance,note,settlement_week,settlement_amount")
      .eq("group_id", groupId).eq("season_year", seasonYear)
  ]);
  if (bankResult.error) throw new Error(bankResult.error.message);
  if (resetsResult.error) throw new Error(resetsResult.error.message);

  const bets: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await supabase.from("side_bets")
      .select("id,week,status,result,creator_id,accepted_by,winner_id,amount,creator_odds,game_id,creator_team,offered_team,creator_spread,offered_spread,market_type")
      .eq("group_id", groupId).eq("season_year", seasonYear)
      .order("created_at", { ascending: false })
      .range(offset, offset + 999);
    if (page.error) throw new Error(page.error.message);
    bets.push(...(page.data || []));
    if (!page.data || page.data.length < 1000) break;
  }

  const resets: any[] = resetsResult.data || [];
  const history = buildBankHistory(bankResult.data || [], bets, resets);
  const held = sideBetReservedFunds(bets);
  const balances: Record<string, number> = {};
  const available: Record<string, number> = {};
  const userIds = new Set([
    ...(bankResult.data || []).map((entry: any) => entry.user_id),
    ...resets.map((reset: any) => reset.user_id),
    ...bets.flatMap((bet) => [bet.creator_id, bet.accepted_by].filter(Boolean))
  ]);
  for (const userId of userIds) {
    const latest = resets.filter((reset) => reset.user_id === userId)
      .sort((a, b) => Number(b.week) - Number(a.week))[0];
    const earned = history.filter((week) => !latest || week.week >= Number(latest.week))
      .reduce((sum, week) => sum + Number(week.totals[userId] || 0), 0);
    const balance = Math.round((Number(latest?.opening_balance || 0) + earned) * 100) / 100;
    balances[userId] = balance;
    available[userId] = availableSideBetFunds(balance, held[userId] || 0);
  }
  return { balances, held, available };
}
