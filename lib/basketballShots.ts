export type BasketballShot = {
  id: string; x: number; y: number; period: number; clock: string; made: boolean;
  teamId: string; player: string; text: string; awayScore: number | null; homeScore: number | null;
};

/** ESPN's shot frame is hoop-relative, not baseline-relative: the normalized
 * basket is approximately (25, 1) in feed coordinates. The SVG court basket
 * is at (25, 5.25) feet from the baseline. See the fitted ESPN coordinate
 * documentation in sportsdataverse. Never modify an actual coordinate based
 * on a shot's reported point value. */
export const ESPN_SHOT_HOOP_Y = 1;
export const COURT_HOOP_Y = 5.25;
export function shotDistanceFromHoop(x: number, y: number) {
  return Math.hypot(x - 25, y - ESPN_SHOT_HOOP_Y);
}
export function shotBaselineDistance(y: number) {
  return COURT_HOOP_Y + (y - ESPN_SHOT_HOOP_Y);
}

export function basketballShots(plays: any[], athletes = new Map<string, string>()): BasketballShot[] {
  return plays.flatMap((play): BasketballShot[] => {
    const { x, y } = play.coordinate || {};
    if (!play.shootingPlay || ![2, 3].includes(Number(play.pointsAttempted)) ||
      typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 50 || y < -2 || y > 94) return [];
    const score = (value: unknown) => value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
    const rawPeriod = Number(play.period?.number);
    const period = Number.isInteger(rawPeriod) && rawPeriod >= 1 && rawPeriod <= 50 ? rawPeriod : 1;
    const shooter = String(play.participants?.[0]?.athlete?.id || "");
    return [{
      id: String(play.id), x, y, period, clock: String(play.clock?.displayValue || ""),
      made: Boolean(play.scoringPlay), teamId: String(play.team?.id || ""), player: athletes.get(shooter) || "Shooter unavailable",
      text: String(play.text || ""), awayScore: score(play.awayScore), homeScore: score(play.homeScore)
    }];
  });
}

export function basketballPeriodLabel(period: number, college: boolean) {
  const regulation = college ? 2 : 4;
  return period > regulation ? `${period - regulation}OT` : college ? `${period === 1 ? "1st" : "2nd"} Half` : `Quarter ${period}`;
}

export function filterBasketballShots(shots: BasketballShot[], teamId: string, period: string, currentPeriod: number) {
  return shots.filter(shot => (teamId === "all" || shot.teamId === teamId) &&
    (period === "all" || shot.period === (period === "current" ? currentPeriod : Number(period))));
}
