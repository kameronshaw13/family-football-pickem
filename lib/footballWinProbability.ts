export type FootballProbabilityPoint = {
  id: string;
  home: number;
  progress: number;
  period: number;
  clock: string;
  awayScore: number | null;
  homeScore: number | null;
  push?: boolean;
};

/** Four 15-minute regulation quarters, followed by an extended OT domain. */
export function footballTimeProgress(periodInput: unknown, clockInput: unknown): number | null {
  const raw = String(periodInput ?? "").trim();
  const period = /^OT$/i.test(raw) ? 5 : /^\d+OT$/i.test(raw)
    ? 4 + Number(raw.match(/\d+/)?.[0]) : Number(raw.match(/\d+/)?.[0]);
  if (!Number.isFinite(period) || period < 1) return null;
  const match = String(clockInput ?? "").match(/(\d{1,2}):(\d{2}(?:\.\d+)?)/);
  if (!match) return period > 4 ? 1 + (period - 5) * .075 : null;
  const seconds = Math.min(900, Math.max(0, Number(match[1]) * 60 + Number(match[2])));
  const played = 1 - seconds / 900;
  return period <= 4 ? ((period - 1) + played) / 4 : 1 + (period - 5 + played) * .075;
}

export function normalizeFootballWinProbability(
  entries: any[], rawPlays: any[], completed: boolean, homeFinal: number | null, awayFinal: number | null
): FootballProbabilityPoint[] {
  const playsById = new Map(rawPlays.filter(Boolean).map(play => [String(play.id ?? ""), play]));
  const points = entries.flatMap((entry, index) => {
    const home = Number(entry?.homeWinPercentage);
    if (!Number.isFinite(home) || home < 0 || home > 1) return [];
    const play = playsById.get(String(entry?.playId ?? ""));
    if (!play) return [];
    const period = Number(play?.period?.number || play?.period?.value || 1);
    const clock = String(play?.clock?.displayValue || "");
    const progress = footballTimeProgress(period, clock);
    if (progress == null) return [];
    const score = (value: unknown) => value == null || String(value).trim() === "" || !Number.isFinite(Number(value)) ? null : Number(value);
    return [{ id: String(entry.playId ?? index), home, progress, period, clock,
      awayScore: score(play.awayScore), homeScore: score(play.homeScore) }];
  }).sort((a, b) => a.progress - b.progress);
  const deduped = points.filter((point, index) => index === 0 || point.id !== points[index - 1].id);
  if (completed && deduped.length > 0 && homeFinal != null && awayFinal != null) {
    const last = deduped[deduped.length - 1];
    deduped.push({ ...last, id: "final-probability", progress: Math.max(1, last.progress + .001),
      home: homeFinal > awayFinal ? 1 : homeFinal < awayFinal ? 0 : .5,
      homeScore: homeFinal, awayScore: awayFinal, clock: "0:00" });
  }
  return deduped;
}

function normalCdf(x: number): number {
  const z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + .3275911 * z);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - .284496736) * t + .254829592) * t) * Math.exp(-z * z);
  return (1 + (x < 0 ? -erf : erf)) / 2;
}
function normalQuantile(value: number): number {
  let low = -8, high = 8;
  for (let index = 0; index < 48; index++) {
    const middle = (low + high) / 2;
    if (normalCdf(middle) < value) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

/** Estimated point-spread cover likelihood, not an ESPN-supplied number.
 * Use only when the saved spread and ESPN's opening win probability
 * imply a valid positive full-game margin variance. */
export function estimatedFootballCoverPoints(points: FootballProbabilityPoint[], homeSpread: number | null, completed: boolean): FootballProbabilityPoint[] {
  if (homeSpread == null || !Number.isFinite(homeSpread)) return [];
  if (homeSpread === 0) return points.map((point, index) => {
    if (!completed || index !== points.length - 1 || point.homeScore == null || point.awayScore == null) return point;
    const margin = point.homeScore - point.awayScore;
    return { ...point, home: margin > 0 ? 1 : margin < 0 ? 0 : .5, push: margin === 0 };
  });
  const opening = points.find(point => point.progress <= .065 && point.homeScore === 0 && point.awayScore === 0 && point.home > 0 && point.home < 1);
  if (!opening) return [];
  const z = normalQuantile(opening.home);
  const sigma = -homeSpread / z;
  if (!Number.isFinite(sigma) || sigma <= 0) return [];
  return points.flatMap((point, index) => {
    if (point.homeScore == null || point.awayScore == null) return [];
    const margin = point.homeScore - point.awayScore;
    const adjusted = margin + homeSpread;
    if (completed && index === points.length - 1) {
      return [{ ...point, home: adjusted > 0 ? 1 : adjusted < 0 ? 0 : .5, push: adjusted === 0 }];
    }
    // At regulation's end a tied game can proceed to overtime; estimate
    // uncertainty rather than falsely reporting a decided cover.
    const remaining = Math.max(.015, 1 - Math.min(1, point.progress));
    const meanMargin = margin - homeSpread * remaining;
    return [{ ...point, home: normalCdf((meanMargin + homeSpread) / (sigma * Math.sqrt(remaining))) }];
  });
}
