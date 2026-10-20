/** Choose displayed scores consistently between the Pick Board and GameTracker.
 * Final scores override in-progress feeds; during live play the board scoreboard
 * is preferred to the ESPN summary, which may lag play-by-play.
 */
export function trackerDisplayScore(
  completed: boolean, live: boolean,
  finalScore: number | null | undefined,
  boardScore: number | null | undefined,
  summaryScore: number | null | undefined,
  fallback: number | null | undefined
): number | null {
  if (completed) return finalScore ?? summaryScore ?? fallback ?? null;
  if (live) return boardScore ?? summaryScore ?? fallback ?? null;
  return summaryScore ?? fallback ?? null;
}
