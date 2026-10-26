import { sideBetNetForUser } from "./sideBetMarkets.ts";

type ProfilePick = {
  pick_type: string;
  result: string | null;
  underdog_win_value?: number | null;
  locked_spread?: number | null;
  game?: { league?: string } | null;
};
type ProfileBet = Parameters<typeof sideBetNetForUser>[0] & {
  id?: string;
  game_id?: string;
  season_year?: number;
  game?: { espn_event_id?: string | null; league?: string; commence_time?: string; home_team?: string; away_team?: string } | null;
};

function matchupKey(bet: ProfileBet) {
  const game = bet.game;
  return game?.league && game.commence_time && game.home_team && game.away_team
    ? [game.league, game.commence_time, game.home_team.toLowerCase(), game.away_team.toLowerCase()].join("|")
    : null;
}

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
  // ESPN and odds imports may use different row IDs for the same matchup.
  const eventsByMatchup = new Map<string, string>();
  for (const bet of settled) {
    const key = matchupKey(bet);
    if (key && bet.game?.espn_event_id) eventsByMatchup.set(key, `${bet.game.league}:${bet.game.espn_event_id}`);
  }
  const gameNets = new Map<string, number>();
  settled.forEach((bet, index) => {
    const matchup = matchupKey(bet);
    const eventKey = bet.game?.espn_event_id ? `${bet.game.league}:${bet.game.espn_event_id}` : null;
    const key = eventKey || (matchup && eventsByMatchup.get(matchup)) || matchup || bet.game_id || bet.id || `unknown-${index}`;
    gameNets.set(key, (gameNets.get(key) || 0) + nets[index]);
  });
  const gameTotals = [...gameNets.values()].map(net => Math.round(net * 100) / 100);
  const wins = nets.filter(net => net > 0).length;
  const losses = nets.filter(net => net < 0).length;
  return {
    leagues,
    dogs: { wins: dogWins.length, attempts: dogs.length, bonusWins },
    sideBets: {
      settled: settled.length,
      winPct: wins + losses ? wins / (wins + losses) : null,
      biggestWin: Math.max(0, ...gameTotals),
      biggestLoss: Math.min(0, ...gameTotals)
    }
  };
}
export type PlayerProfileStats = ReturnType<typeof playerProfileStats>;
