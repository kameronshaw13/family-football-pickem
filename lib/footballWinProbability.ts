export type FootballProbabilityPoint = {
  id: string;
  home: number;
  progress: number;
  period: number;
  clock: string;
  awayScore: number | null;
  homeScore: number | null;
  /** ESPN's point-spread cover probability, when supplied by the core feed. */
  homeCover?: number | null;
  coverPush?: number | null;
  push?: boolean;
};

/** Four regulation quarters and extended periods for overtime. */
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

function optionalNumber(value: unknown): number | null {
  return value == null || (typeof value === "string" && !value.trim()) || !Number.isFinite(Number(value))
    ? null : Number(value);
}
function probability(value: unknown): number | null {
  const parsed = optionalNumber(value);
  if (parsed == null || parsed < 0) return null;
  if (parsed <= 1) return parsed;
  return parsed <= 100 ? parsed / 100 : null;
}
function playId(entry: any): string {
  const ref = String(entry?.play?.$ref || entry?.play?.href || "");
  const embedded = ref.match(/\/plays\/([^/?#]+)/i)?.[1] || "";
  return String(entry?.playId || embedded || entry?.play?.id || entry?.id || "");
}

/** Keep ESPN's real probability values even when a playId has no drive-play match.
 * The prior implementation silently discarded every unmatched point, which
 * made ESPN games with available charts appear to have no win probability. */
export function normalizeFootballWinProbability(
  entries: any[], rawPlays: any[], completed: boolean, homeFinal: number | null, awayFinal: number | null
): FootballProbabilityPoint[] {
  if (!Array.isArray(entries) || !entries.length) return [];
  const playsById = new Map<string, any>();
  for (const play of rawPlays) {
    if (play?.id != null) playsById.set(String(play.id), play);
  }
  const ordered = entries.slice().sort((a, b) => {
    const first = optionalNumber(a?.sequenceNumber);
    const second = optionalNumber(b?.sequenceNumber);
    return first != null && second != null ? first - second : 0;
  });
  const points: FootballProbabilityPoint[] = ordered.flatMap((entry, index) => {
    const home = probability(entry?.homeWinPercentage ?? entry?.homeWinProbability);
    if (home == null) return [];
    const id = playId(entry);
    const play = playsById.get(id);
    const period = Number(play?.period?.number || play?.period?.value || 0);
    const clock = String(play?.clock?.displayValue || "");
    const secondsLeft = optionalNumber(entry?.secondsLeft);
    const clockProgress = footballTimeProgress(period, clock);
    // The core feed includes secondsLeft even for plays omitted from summary.drives.
    const secondProgress = secondsLeft == null ? null
      : secondsLeft >= 0 ? Math.max(0, 1 - secondsLeft / 3600)
      : 1 + Math.abs(secondsLeft) / 3600;
    const progress = clockProgress ?? secondProgress ?? (ordered.length === 1 ? 0 : index / (ordered.length - 1));
    return [{
      id: id || "probability-" + index,
      home,
      progress,
      period,
      clock,
      awayScore: optionalNumber(play?.awayScore ?? entry?.awayScore),
      homeScore: optionalNumber(play?.homeScore ?? entry?.homeScore),
      homeCover: probability(entry?.spreadCoverProbHome),
      coverPush: probability(entry?.spreadPushProb)
    }];
  }).sort((a, b) => a.progress - b.progress);
  const unique = points.filter((point, index) => index === 0
    || point.id !== points[index - 1].id
    || Math.abs(point.progress - points[index - 1].progress) > .0001);
  if (completed && unique.length > 0 && homeFinal != null && awayFinal != null) {
    const last = unique[unique.length - 1];
    unique.push({
      ...last,
      id: "final-probability",
      period: Math.max(4, last.period || 4),
      clock: "0:00",
      progress: Math.max(1, last.progress + .0001),
      home: homeFinal > awayFinal ? 1 : homeFinal < awayFinal ? 0 : .5,
      awayScore: awayFinal,
      homeScore: homeFinal,
      // The actual closing spread is resolved by the chart component.
      homeCover: null,
      coverPush: null
    });
  }
  return unique;
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

/** Cover fallback based on the saved spread and calibrated ESPN win probability.
 * Not sportsbook odds. Do not assume a made-up score variance. */
export function estimatedFootballCoverPoints(points: FootballProbabilityPoint[], homeSpread: number | null, completed: boolean): FootballProbabilityPoint[] {
  if (homeSpread == null || !Number.isFinite(homeSpread)) return [];
  if (homeSpread === 0) return points.map((point, index) => {
    if (!completed || index !== points.length - 1 || point.homeScore == null || point.awayScore == null) return point;
    const margin = point.homeScore - point.awayScore;
    return { ...point, home: margin > 0 ? 1 : margin < 0 ? 0 : .5, push: margin === 0 };
  });
  const opening = points.find(point =>
    point.progress <= .13 &&
    point.home > 0 && point.home < 1 &&
    (point.homeScore == null || point.awayScore == null || point.homeScore === 0 && point.awayScore === 0));
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
    const remaining = Math.max(.015, 1 - Math.min(1, point.progress));
    const expectedMargin = margin - homeSpread * remaining;
    return [{ ...point, home: normalCdf((expectedMargin + homeSpread) / (sigma * Math.sqrt(remaining))) }];
  });
}

/** ESPN core-v2 supplies its own cover series; use it without re-estimating.
 * Only plot it against ESPN's own spread, not a different stored bookmaker line. */
export function espnFootballCoverPoints(points: FootballProbabilityPoint[], espnSpread: number | null, completed: boolean): FootballProbabilityPoint[] {
  const valid = points.filter(point => point.homeCover != null);
  if (!valid.length) return [];
  const series = valid.map(point => ({ ...point, home: point.homeCover!, push: point.coverPush != null && point.coverPush > .99 }));
  if (completed && espnSpread != null) {
    const final = points[points.length - 1];
    if (final?.homeScore != null && final?.awayScore != null) {
      const adjusted = final.homeScore - final.awayScore + espnSpread;
      series.push({ ...final, home: adjusted > 0 ? 1 : adjusted < 0 ? 0 : .5, push: adjusted === 0 });
    }
  }
  return series;
}
