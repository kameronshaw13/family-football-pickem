export type SideBetMarketType = "spread" | "moneyline" | "total";

export function oppositeTotalSide(value: "over" | "under") {
  return value === "over" ? "under" : "over";
}

export function validAmericanOdds(value: unknown) {
  const odds = Number(value);
  return Number.isInteger(odds) && (odds <= -100 || odds >= 100);
}

export function oppositeAmericanOdds(value: number) {
  if (!validAmericanOdds(value)) return 100;
  if (Math.abs(value) === 100) return 100;
  return -value;
}

export function americanOddsText(value: number | null | undefined) {
  const odds = Number(value);
  if (!validAmericanOdds(odds)) return "+100";
  return odds > 0 ? `+${odds}` : String(odds);
}

type FootballLeague = "NFL" | "CFB";

const ALT_TOTAL_ODDS_LADDER = [
  100, 110, 120, 130, 140, 150, 165, 180, 200, 225, 250, 275, 300, 350, 400,
  450, 500, 600, 700, 800, 900, 1000
];

const ALT_SPREAD_FALLBACK_LADDERS: Record<FootballLeague, number[]> = {
  NFL: [
    100, 110, 120, 130, 145, 160, 180, 200, 225, 250, 275, 300, 350, 400, 450,
    500, 600, 700, 800, 900, 1000
  ],
  CFB: [
    100, 110, 115, 125, 135, 145, 155, 170, 185, 200, 225, 250, 275, 300, 350,
    400, 450, 500, 600, 700, 800
  ]
};

const FRIENDLY_ALT_ODDS = [
  100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170,
  175, 180, 185, 190, 195, 200, 205, 210, 215, 220, 225, 230, 235, 240, 245,
  250, 255, 260, 265, 270, 275, 280, 285, 290, 295, 300, 325, 350, 375, 400,
  450, 500, 600, 700, 800, 900, 1000, 1250, 1500, 2000
];

const ALT_SPREAD_KEY_WEIGHTS: Record<FootballLeague, Record<number, number>> = {
  NFL: { 3: 2.4, 7: 1.8, 10: 1.25, 14: 1.2 },
  CFB: { 3: 1.6, 7: 1.35, 10: 1.12, 14: 1.1 }
};

function closestFriendlyAltMagnitude(value: number) {
  return FRIENDLY_ALT_ODDS.reduce((closest, candidate) =>
    Math.abs(candidate - value) < Math.abs(closest - value) ? candidate : closest
  );
}

function impliedProbabilityFromAmericanOdds(value: number) {
  if (!validAmericanOdds(value)) return null;
  return value < 0
    ? Math.abs(value) / (Math.abs(value) + 100)
    : 100 / (value + 100);
}

export function fairSymmetricMoneyline(
  teamOdds: number | null | undefined,
  opponentOdds: number | null | undefined
) {
  const team = Number(teamOdds);
  const opponent = Number(opponentOdds);
  if (!validAmericanOdds(team) || !validAmericanOdds(opponent)) return null;

  const midpointMagnitude = (Math.abs(team) + Math.abs(opponent)) / 2;
  const roundedMagnitude = Math.max(100, Math.round(midpointMagnitude / 5) * 5);
  if (roundedMagnitude === 100) return 100;
  return team < 0 ? -roundedMagnitude : roundedMagnitude;
}

function symmetricMoneylineProbability(teamOdds: number | null | undefined, opponentOdds: number | null | undefined) {
  const fairOdds = fairSymmetricMoneyline(teamOdds, opponentOdds);
  return fairOdds == null ? null : impliedProbabilityFromAmericanOdds(fairOdds);
}

function rawAmericanMagnitudeFromProbability(probability: number) {
  const bounded = Math.max(0.01, Math.min(0.99, probability));
  if (Math.abs(bounded - 0.5) < 0.0001) return 100;
  return bounded > 0.5
    ? 100 * bounded / (1 - bounded)
    : 100 * (1 - bounded) / bounded;
}

function closestFriendlyAltIndex(value: number) {
  let bestIndex = 0;
  for (let index = 1; index < FRIENDLY_ALT_ODDS.length; index += 1) {
    if (Math.abs(FRIENDLY_ALT_ODDS[index] - value) < Math.abs(FRIENDLY_ALT_ODDS[bestIndex] - value)) bestIndex = index;
  }
  return bestIndex;
}

function altSpreadStepWeight(from: number, to: number, league: FootballLeague) {
  const low = Math.min(Math.abs(from), Math.abs(to));
  const high = Math.max(Math.abs(from), Math.abs(to));
  let weight = 1;
  for (const [keyText, keyWeight] of Object.entries(ALT_SPREAD_KEY_WEIGHTS[league])) {
    const key = Number(keyText);
    if (key >= low && key <= high) weight = Math.max(weight, keyWeight);
  }
  return weight;
}

function weightedSpreadDistance(from: number, to: number, league: FootballLeague) {
  if (Math.abs(to - from) < 0.001) return 0;
  const direction = to > from ? 1 : -1;
  let current = from;
  let distance = 0;
  let guard = 0;
  while (Math.abs(to - current) >= 0.001 && guard < 500) {
    const step = Math.min(0.5, Math.abs(to - current));
    const next = current + direction * step;
    distance += altSpreadStepWeight(current, next, league) * (step / 0.5);
    current = next;
    guard += 1;
  }
  return distance;
}

function fallbackAltSpreadOdds(market: number, offered: number, league: FootballLeague) {
  const move = offered - market;
  const steps = Math.max(0, Math.round(Math.abs(move) * 2));
  const ladder = ALT_SPREAD_FALLBACK_LADDERS[league];
  const magnitude = ladder[Math.min(steps, ladder.length - 1)];
  return move > 0 ? -magnitude : magnitude;
}

export function fairAltSpreadOdds(
  marketSpread: number | null | undefined,
  offeredSpread: number | null | undefined,
  options: {
    teamMoneylineOdds?: number | null;
    opponentMoneylineOdds?: number | null;
    league?: FootballLeague;
  } = {}
) {
  const market = Number(marketSpread);
  const offered = Number(offeredSpread);
  const league = options.league === "NFL" ? "NFL" : "CFB";
  if (!Number.isFinite(market) || !Number.isFinite(offered)) return 100;

  const move = offered - market;
  if (Math.abs(move) < 0.25) return 100;

  const moneylineProbability = symmetricMoneylineProbability(options.teamMoneylineOdds, options.opponentMoneylineOdds);
  const moneylineSpread = market < -0.5 ? -0.5 : market > 0.5 ? 0.5 : null;
  const moneylineDirectionMatchesSpread = moneylineProbability != null && (
    (market < -0.5 && moneylineProbability > 0.5) ||
    (market > 0.5 && moneylineProbability < 0.5)
  );

  if (moneylineSpread != null && moneylineDirectionMatchesSpread) {
    const anchorDistance = weightedSpreadDistance(market, moneylineSpread, league);
    if (anchorDistance > 0) {
      const directionToMoneyline = moneylineSpread > market ? 1 : -1;
      const moneylineLogit = Math.log(moneylineProbability! / (1 - moneylineProbability!));
      const halfPointSteps = Math.max(1, Math.round(Math.abs(move) * 2));
      const halfPointMove = move > 0 ? 0.5 : -0.5;
      let previousMagnitudeIndex = 0;
      let finalMagnitude = FRIENDLY_ALT_ODDS[1];

      for (let step = 1; step <= halfPointSteps; step += 1) {
        const intermediate = step === halfPointSteps ? offered : market + halfPointMove * step;
        const moveDirection = Math.sign((intermediate - market) * directionToMoneyline) || 1;
        const progress = moveDirection * weightedSpreadDistance(market, intermediate, league) / anchorDistance;
        const coverProbability = 1 / (1 + Math.exp(-(progress * moneylineLogit)));
        const modeledMagnitude = rawAmericanMagnitudeFromProbability(coverProbability);
        const modeledIndex = closestFriendlyAltIndex(modeledMagnitude);
        previousMagnitudeIndex = Math.min(
          FRIENDLY_ALT_ODDS.length - 1,
          Math.max(modeledIndex, previousMagnitudeIndex + 1)
        );
        finalMagnitude = FRIENDLY_ALT_ODDS[previousMagnitudeIndex];
      }

      return move > 0 ? -finalMagnitude : finalMagnitude;
    }
  }

  return fallbackAltSpreadOdds(market, offered, league);
}

export function fairAltTotalOdds(
  marketTotal: number | null | undefined,
  offeredTotal: number | null | undefined,
  side: "over" | "under"
) {
  const market = Number(marketTotal);
  const offered = Number(offeredTotal);
  if (!Number.isFinite(market) || !Number.isFinite(offered)) return 100;

  const move = offered - market;
  if (Math.abs(move) < 0.25) return 100;
  const easierMove = side === "under" ? move : -move;
  const halfPointSteps = Math.max(0, Math.round(Math.abs(move) * 2));
  const magnitude = ALT_TOTAL_ODDS_LADDER[Math.min(halfPointSteps, ALT_TOTAL_ODDS_LADDER.length - 1)];
  return easierMove > 0 ? -magnitude : magnitude;
}

const HISTORICAL_FAIR_MONEYLINES: Record<FootballLeague, number[]> = {
  // Index is twice the absolute spread (0, 0.5, 1.0, ...). These are fair,
  // symmetric prices derived from historical outright win rates, not book juice.
  CFB: [
    100, 100, 105, 111, 115, 119, 135, 154, 162, 171,
    179, 187, 198, 210, 237, 270, 282, 294, 302, 308,
    342, 383, 398, 415, 443, 475, 488, 506, 571, 658,
    694, 740, 777, 817, 1063, 1487, 1900, 2532, 3604, 6150, 6500
  ],
  NFL: [
    100, 100, 105, 111, 115, 120, 146, 180, 192, 206,
    213, 223, 241, 262, 303, 357, 378, 405, 418, 429,
    510, 614, 675, 747, 770, 785, 835, 900, 1216, 1861,
    2173, 2603, 5163, 5500
  ]
};

// Keep the internal no-vig prices simple enough to read at a glance while
// choosing the closest value to the league-specific historical estimate.
const FRIENDLY_MONEYLINE_LADDER = [
  100, 110, 125, 150, 175, 200, 225, 250, 275, 300,
  350, 400, 450, 500, 600, 700, 800, 900, 1000, 1250,
  1500, 2000
];

function historicalMoneylineMagnitude(points: number, league: FootballLeague) {
  const table = HISTORICAL_FAIR_MONEYLINES[league];
  const tableIndex = points * 2;
  const lowerIndex = Math.min(Math.floor(tableIndex), table.length - 1);
  const upperIndex = Math.min(Math.ceil(tableIndex), table.length - 1);
  const lower = table[lowerIndex];
  const upper = table[upperIndex];
  if (lowerIndex === upperIndex) return lower;
  return lower + (upper - lower) * (tableIndex - lowerIndex);
}

function closestFriendlyMoneyline(value: number) {
  return FRIENDLY_MONEYLINE_LADDER.reduce((closest, candidate) =>
    Math.abs(candidate - value) < Math.abs(closest - value) ? candidate : closest
  );
}

export function fairMoneylineFromSpread(value: number | null | undefined, league: FootballLeague = "CFB") {
  const spread = Number(value);
  if (!Number.isFinite(spread)) return 100;

  const points = Math.abs(spread);
  if (points < 0.25) return 100;

  const magnitude = closestFriendlyMoneyline(historicalMoneylineMagnitude(points, league));
  if (magnitude === 100) return 100;
  return spread < 0 ? -magnitude : magnitude;
}

export function profitForRisk(risk: number, odds: number) {
  const normalizedRisk = Math.max(0, Number(risk) || 0);
  if (!validAmericanOdds(odds)) return normalizedRisk;
  const raw = odds > 0
    ? normalizedRisk * (odds / 100)
    : normalizedRisk * (100 / Math.abs(odds));
  return Math.round(raw * 100) / 100;
}

export function sideBetCreatorProfit(bet: { amount: number; creator_odds?: number | null }) {
  return profitForRisk(Number(bet.amount), Number(bet.creator_odds ?? 100));
}

export function sideBetRiskForUser(
  bet: { creator_id: string; accepted_by?: string | null; amount: number; creator_odds?: number | null },
  userId: string
) {
  if (bet.creator_id === userId) return Math.round(Number(bet.amount) * 100) / 100;
  return sideBetCreatorProfit(bet);
}

export function sideBetProfitForUser(
  bet: { creator_id: string; accepted_by?: string | null; amount: number; creator_odds?: number | null },
  userId: string
) {
  if (bet.creator_id === userId) return sideBetCreatorProfit(bet);
  return Math.round(Number(bet.amount) * 100) / 100;
}

export function sideBetNetForUser(
  bet: {
    creator_id: string;
    accepted_by?: string | null;
    winner_id?: string | null;
    result?: string | null;
    status?: string | null;
    amount: number;
    creator_odds?: number | null;
  },
  userId: string
) {
  if (bet.status !== "settled" || bet.result === "push") return 0;
  const involved = bet.creator_id === userId || bet.accepted_by === userId;
  if (!involved) return 0;

  const creatorWon = bet.winner_id
    ? bet.winner_id === bet.creator_id
    : bet.result === "creator_win";
  if (userId === bet.creator_id) {
    return creatorWon ? sideBetCreatorProfit(bet) : -Math.round(Number(bet.amount) * 100) / 100;
  }
  return creatorWon ? -sideBetCreatorProfit(bet) : Math.round(Number(bet.amount) * 100) / 100;
}
