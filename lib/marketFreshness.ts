/** Accept only sufficiently recent provider rows, with at most five seconds of clock skew. */
export function isFreshMarketTimestamp(inserted: string | null | undefined, maxAgeSeconds: number, now = Date.now()) {
  if (!inserted || !Number.isFinite(maxAgeSeconds) || maxAgeSeconds < 0) return false;
  const time = Date.parse(inserted);
  if (!Number.isFinite(time)) return false;
  const age = (now - time) / 1000;
  return age >= -5 && age <= maxAgeSeconds;
}
