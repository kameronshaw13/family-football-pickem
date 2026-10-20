/**
 * Retain chronological scoring rows, grouping adjacent plays by quarter.
 * A previous score always refers to the actual previous play, even at quarter
 * boundaries; the UI uses it to highlight only the team whose score changed.
 */
export function groupTrackerScoringPlays<T extends { period: string }>(
  plays: readonly T[],
  periodLabel: (period: string) => string
): Array<{ label: string; rows: Array<{ play: T; previous: T | undefined }> }> {
  const result: Array<{ label: string; rows: Array<{ play: T; previous: T | undefined }> }> = [];
  plays.forEach((play, index) => {
    const label = periodLabel(play.period);
    if (!result.length || result[result.length - 1].label !== label) {
      result.push({ label, rows: [] });
    }
    result[result.length - 1].rows.push({ play, previous: plays[index - 1] });
  });
  return result;
}
