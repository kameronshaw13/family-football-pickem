import type { BankHistoryWeek } from "./bankHistory";

/** Label each settlement using the previous settlement as the start of its period. */
export function bankPayoutLabels(weeks: Pick<BankHistoryWeek, "week" | "payoutAmounts">[]) {
  const payoutWeeks = Array.from(new Set(
    weeks.filter((week) => Object.keys(week.payoutAmounts || {}).length > 0).map((week) => week.week)
  )).sort((a, b) => a - b);

  const labels = new Map<number, string>();
  let previousSettlementWeek = 0;
  for (const week of payoutWeeks) {
    const firstWeek = previousSettlementWeek + 1;
    labels.set(week, firstWeek === week ? `Week ${week} Payout` : `Weeks ${firstWeek}-${week} Payout`);
    previousSettlementWeek = week;
  }
  return labels;
}
