type Score = { away: number; home: number };
type TimedScore = Score & { progress: number };
type ScorePlay = { awayScore: number | null; homeScore: number | null; progress?: number | null };

export function basketballTimeProgress(period: number, clock: string, college: boolean): number | null {
  const match = /^(?:(\d+):([0-5]\d(?:\.\d+)?)|(\d+(?:\.\d+)?))$/.exec(clock.trim());
  if (!match || !Number.isInteger(period) || period < 1) return null;

  const periods = college ? 2 : 4;
  const periodLength = college ? 1200 : 720;
  const regulationLength = periods * periodLength;
  const overtime = Math.max(0, period - periods);
  const duration = overtime ? 300 : periodLength;
  const elapsedBeforePeriod = overtime ? regulationLength + (overtime - 1) * 300 : (period - 1) * periodLength;
  const remaining = match[3] == null ? Number(match[1]) * 60 + Number(match[2]) : Number(match[3]);
  if (remaining > duration) return null;

  return (elapsedBeforePeriod + duration - remaining) / regulationLength;
}

export function basketballScoreFlow(plays: ScorePlay[], final?: { away: number | null; home: number | null; period: number; college: boolean }) {
  const timedScores = plays.flatMap(({ awayScore, homeScore, progress }): TimedScore[] =>
    awayScore != null && Number.isInteger(awayScore) && awayScore >= 0
      && homeScore != null && Number.isInteger(homeScore) && homeScore >= 0
      && progress != null && Number.isFinite(progress) && progress >= 0
      ? [{ away: awayScore, home: homeScore, progress }]
      : []
  ).sort((a, b) => a.progress - b.progress);
  const points: TimedScore[] = [{ away: 0, home: 0, progress: 0 }];
  for (const score of timedScores) {
    const previous = points[points.length - 1];
    if (score.away !== previous.away || score.home !== previous.home) points.push(score);
  }

  if (timedScores.length && final?.away != null && final.home != null) {
    const regulation = final.college ? 2 : 4;
    const end = basketballTimeProgress(Math.max(regulation, final.period), "0", final.college) ?? 1;
    const progress = Math.max(end, timedScores[timedScores.length - 1].progress);
    points.push({ away: final.away, home: final.home, progress });
  }

  const highest = Math.max(40, ...points.flatMap(({ away, home }) => [away, home]));
  const interval = Math.ceil(highest / 40) * 10;
  const ticks = Array.from({ length: 5 }, (_, index) => index * interval);
  return { points, ticks, ceiling: interval * 4, domain: Math.max(1, points[points.length - 1].progress) };
}
