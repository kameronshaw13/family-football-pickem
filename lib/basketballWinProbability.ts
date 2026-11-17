export type BasketballProbabilityPoint = {
  id: string; home: number; progress: number; push?: boolean;
  period?: number; clock?: string; awayScore?: number | null; homeScore?: number | null;
};

export function nearestProbabilityPoint(points: BasketballProbabilityPoint[], progress: number) {
  if (!points.length) return null;
  return points.reduce((closest, point) => Math.abs(point.progress - progress) <= Math.abs(closest.progress - progress) ? point : closest);
}

function normalCdf(value: number) {
  const x = Math.abs(value) / Math.SQRT2;
  const t = 1 / (1 + .3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - .284496736) * t + .254829592) * t) * Math.exp(-x * x);
  return (1 + (value < 0 ? -erf : erf)) / 2;
}
function normalQuantile(probability: number) {
  let low = -8, high = 8;
  for (let i = 0; i < 50; i++) {
    const middle = (low + high) / 2;
    if (normalCdf(middle) < probability) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

/** Brownian score-margin estimate (Stern; Polson/Stern implied volatility).
 * https://www.stat.berkeley.edu/~aldous/157/Papers/stern.pdf
 * https://doi.org/10.1515/jqas-2014-0095
 * Infer full-game variance from opening win probability and the saved pregame
 * spread. Never substitute arbitrary variance when those inputs are missing.
 * This is an estimate; it is not a provider-supplied cover probability.
 */
export function estimatedCoverPoints(points: BasketballProbabilityPoint[], homeSpread: number | null, college: boolean, completed: boolean): BasketballProbabilityPoint[] {
  if (homeSpread == null || !Number.isFinite(homeSpread)) return [];
  const opening = points.find(point => point.progress <= .025 && point.homeScore === 0 && point.awayScore === 0 && point.home > 0 && point.home < 1);
  if (!opening) return [];
  const z = normalQuantile(opening.home);
  if (homeSpread !== 0 && Math.abs(z) < .0001) return [];
  const sigma = homeSpread === 0 ? null : -homeSpread / z;
  if (homeSpread !== 0 && (!sigma || !Number.isFinite(sigma) || sigma <= 0)) return [];
  const periods = college ? 2 : 4;
  const minutes = college ? 40 : 48;
  return points.flatMap((point, index) => {
    if (point.awayScore == null || point.homeScore == null) return [];
    const margin = point.homeScore - point.awayScore;
    const adjusted = margin + homeSpread;
    const match = point.clock?.match(/^(\d+):(\d+(?:\.\d+)?)$/);
    const period = point.period || 1;
    let remaining = period > periods
      ? match ? (Number(match[1]) * 60 + Number(match[2])) / 60 : null
      : Math.max(0, 1 - point.progress) * minutes;
    const final = completed && index === points.length - 1;
    if (final || remaining === 0 && margin !== 0) return [{ ...point, home: adjusted > 0 ? 1 : adjusted < 0 ? 0 : .5, push: adjusted === 0 }];
    if (remaining === 0 && margin === 0) remaining = 5; // A tied regulation/OT period continues.
    if (remaining == null) return [];
    if (homeSpread === 0) return [{ ...point }];
    const fraction = remaining / minutes;
    const meanMargin = margin - homeSpread * fraction;
    return [{ ...point, home: normalCdf((meanMargin + homeSpread) / (sigma! * Math.sqrt(fraction))) }];
  });
}
