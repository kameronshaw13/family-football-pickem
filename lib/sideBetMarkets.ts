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
