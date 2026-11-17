export type BasketballProbabilityPoint = {
  id: string; home: number; progress: number;
  period?: number; clock?: string; awayScore?: number | null; homeScore?: number | null;
};

export function nearestProbabilityPoint(points: BasketballProbabilityPoint[], progress: number) {
  if (!points.length) return null;
  return points.reduce((closest, point) => Math.abs(point.progress - progress) <= Math.abs(closest.progress - progress) ? point : closest);
}
