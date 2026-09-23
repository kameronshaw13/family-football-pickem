export type SideBetMarketType = "spread" | "moneyline";

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
