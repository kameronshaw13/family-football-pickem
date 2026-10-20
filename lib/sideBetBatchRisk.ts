/** Total batch stakes in integer cents for validation. Credit is not prepaid. */
export function batchSideBetTotalRisk(amounts: readonly number[]) {
  const cents = amounts.reduce((sum, amount) => {
    if (!Number.isFinite(amount) || amount <= 0) return NaN;
    return sum + Math.round(amount * 100);
  }, 0);
  return Number.isFinite(cents) ? cents / 100 : null;
}
