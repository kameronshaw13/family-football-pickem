import { sideBetNetForUser } from "./sideBetMarkets.ts";

type ProfilePick = {
  pick_type: string;
  result: string | null;
  underdog_win_value?: number | null;
  locked_spread?: number | null;
  game?: { league?: string } | null;
};
type ProfileBet = Parameters<typeof sideBetNetForUser>[0];

/** Inputs have already been restricted to the player and selected profile period. */
export function playerProfileStats(picks: ProfilePick[], bets: ProfileBet[], userId: string) {
  const leagues = ["CFB", "NFL", "CBB", "NBA"].flatMap(league => {
    const regular = picks.filter(pick => pick.pick_type === "regular" && pick.game?.league === league);
    if (!regular.length) return [];
    const wins = regular.filter(pick => pick.result === "win").length;
    const losses = regular.filter(pick => pick.result === "loss").length;
    const pushes = regular.filter(pick => pick.result === "push").length;
    return [{ league, wins, losses, pushes, winPct: wins + losses ? wins / (wins + losses) : null }];
  });
  const dogs = picks.filter(pick => pick.pick_type === "underdog" && ["win", "loss", "push"].includes(pick.result || ""));
  const dogWins = dogs.filter(pick => pick.result === "win");
  const bonusWins = dogWins.reduce((sum, pick) => {
    const stored = Number(pick.underdog_win_value);
    if (Number.isFinite(stored) && stored > 0) return sum + stored;
    const spread = Number(pick.locked_spread);
    return sum + (spread >= 20 ? 3 : spread >= 10 ? 2 : spread >= 7 ? 1 : 0);
  }, 0);
  const settled = bets.filter(bet => bet.status === "settled" && (bet.creator_id === userId || bet.accepted_by === userId));
  const nets = settled.map(bet => sideBetNetForUser(bet, userId));
  const wins = nets.filter(net => net > 0).length;
  const losses = nets.filter(net => net < 0).length;
  return {
    leagues,
    dogs: { wins: dogWins.length, attempts: dogs.length, bonusWins },
    sideBets: {
      settled: settled.length,
      winPct: wins + losses ? wins / (wins + losses) : null,
      biggestWin: Math.max(0, ...nets),
      biggestLoss: Math.min(0, ...nets)
    }
  };
}
export type PlayerProfileStats = ReturnType<typeof playerProfileStats>;
