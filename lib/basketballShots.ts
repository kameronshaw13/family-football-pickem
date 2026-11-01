export type BasketballShot = {
  id: string; x: number; y: number; period: number; clock: string; made: boolean;
  teamId: string; player: string; text: string; awayScore: number | null; homeScore: number | null;
};

/** ESPN uses court feet with the attacking basket at (25, 5.25).
 * Reject sentinel/missing coordinates and non-field-goal events; never guess a location. */
export function basketballShots(plays: any[], athletes = new Map<string, string>()): BasketballShot[] {
  return plays.flatMap((play): BasketballShot[] => {
    const { x, y } = play.coordinate || {};
    if (!play.shootingPlay || ![2, 3].includes(Number(play.pointsAttempted)) ||
      typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 50 || y < 0 || y > 94) return [];
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
  return period > regulation ? `${period - regulation}OT` : college ? `${period === 1 ? "1st" : "2nd"} Half` : `Q${period}`;
}

export function filterBasketballShots(shots: BasketballShot[], teamId: string, period: string, currentPeriod: number) {
  return shots.filter(shot => (teamId === "all" || shot.teamId === teamId) &&
    (period === "all" || shot.period === (period === "current" ? currentPeriod : Number(period))));
}
