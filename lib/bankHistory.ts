import type { BankEntry, SideBet } from "./types.ts";
import { sideBetCreatorProfit } from "./sideBetMarkets.ts";

export type BankHistoryGame = {
  gameId: string;
  league: string;
  commenceTime: string;
  awayTeam: string;
  homeTeam: string;
  betCount: number;
  betCounts: Record<string, number>;
  amounts: Record<string, number>;
  winningSelections: Array<{ team: string; spread: number; marketType: "spread" | "moneyline" }>;
};

export type BankHistoryWeek = {
  week: number;
  weeklyAmounts: Record<string, number>;
  games: BankHistoryGame[];
  totals: Record<string, number>;
};

type HistorySideBet = SideBet & {
  game?: {
    league?: string | null;
    commence_time?: string | null;
    away_team?: string | null;
    home_team?: string | null;
  };
};

function addAmount(amounts: Record<string, number>, userId: string, amount: number) {
  amounts[userId] = Number(amounts[userId] || 0) + Number(amount || 0);
}

function ensureWeek(map: Map<number, BankHistoryWeek>, week: number) {
  let row = map.get(week);
  if (!row) {
    row = { week, weeklyAmounts: {}, games: [], totals: {} };
    map.set(week, row);
  }
  return row;
}

export function buildBankHistory(bankEntries: BankEntry[], sideBets: HistorySideBet[]) {
  const byWeek = new Map<number, BankHistoryWeek>();
  const gameMaps = new Map<number, Map<string, BankHistoryGame>>();

  for (const entry of bankEntries || []) {
    const week = Number(entry.week);
    if (!Number.isFinite(week)) continue;
    const row = ensureWeek(byWeek, week);
    addAmount(row.weeklyAmounts, entry.user_id, Number(entry.amount || 0));
    addAmount(row.totals, entry.user_id, Number(entry.amount || 0));
  }

  for (const bet of sideBets || []) {
    if (bet.status !== "settled" || bet.result === "push" || !bet.accepted_by || !bet.winner_id) continue;
    const week = Number(bet.week);
    if (!Number.isFinite(week)) continue;

    const loserId = bet.winner_id === bet.creator_id ? bet.accepted_by : bet.creator_id;
    const transfer = bet.winner_id === bet.creator_id ? sideBetCreatorProfit(bet) : Number(bet.amount || 0);
    if (!Number.isFinite(transfer) || transfer < 0) continue;

    const row = ensureWeek(byWeek, week);
    let games = gameMaps.get(week);
    if (!games) {
      games = new Map<string, BankHistoryGame>();
      gameMaps.set(week, games);
    }

    let game = games.get(bet.game_id);
    if (!game) {
      game = {
        gameId: bet.game_id,
        league: String(bet.game?.league || ""),
        commenceTime: String(bet.game?.commence_time || ""),
        awayTeam: String(bet.game?.away_team || bet.offered_team || ""),
        homeTeam: String(bet.game?.home_team || bet.creator_team || ""),
        betCount: 0,
        betCounts: {},
        amounts: {},
        winningSelections: []
      };
      games.set(bet.game_id, game);
      row.games.push(game);
    }

    game.betCount += 1;
    const creatorWon = bet.winner_id === bet.creator_id;
    const winningTeam = creatorWon ? bet.creator_team : bet.offered_team;
    const rawWinningSpread = Number(creatorWon ? bet.creator_spread : bet.offered_spread);
    const winningSelection = {
      team: winningTeam,
      spread: Number.isFinite(rawWinningSpread) ? rawWinningSpread : 0,
      marketType: bet.market_type === "moneyline" ? "moneyline" as const : "spread" as const
    };
    if (!game.winningSelections.some((selection) =>
      selection.team === winningSelection.team &&
      selection.spread === winningSelection.spread &&
      selection.marketType === winningSelection.marketType
    )) game.winningSelections.push(winningSelection);
    game.betCounts[bet.creator_id] = Number(game.betCounts[bet.creator_id] || 0) + 1;
    game.betCounts[bet.accepted_by] = Number(game.betCounts[bet.accepted_by] || 0) + 1;
    addAmount(game.amounts, bet.winner_id, transfer);
    addAmount(game.amounts, loserId, -transfer);
    addAmount(row.totals, bet.winner_id, transfer);
    addAmount(row.totals, loserId, -transfer);
  }

  return Array.from(byWeek.values())
    .map((row) => ({
      ...row,
      games: [...row.games].sort((a, b) =>
        new Date(a.commenceTime || 0).getTime() - new Date(b.commenceTime || 0).getTime()
      )
    }))
    .sort((a, b) => b.week - a.week);
}
