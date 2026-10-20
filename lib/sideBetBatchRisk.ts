/** Calculate batch exposure in integer cents before a multi-send request.
 * The server independently checks current funds and remains authoritative.
 */
export function batchSideBetTotalRisk(amounts: readonly number[]) {
  const cents = amounts.reduce((sum, amount) => {
    if (!Number.isFinite(amount) || amount <= 0) return NaN;
    return sum + Math.round(amount * 100);
  }, 0);
  return Number.isFinite(cents) ? cents / 100 : null;
}
export function batchSideBetRiskCovered(available: number, amounts: readonly number[]) {
  const risk = batchSideBetTotalRisk(amounts);
  return risk != null && risk > 0 && Number.isFinite(available) && Math.round(available * 100) >= Math.round(risk * 100);
}
