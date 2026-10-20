import type { BankEntry, Game, Pick, Profile, SideBet } from "./types.ts";
import { computeWeeklySettlement, computeWeeklyStandings } from "./weeklyBank.ts";

type TestPickRow = {
  id: string;
  gameId: string;
  team: string;
  spread: number;
  matchup: string;
  finalScore: string;
  result: "win" | "loss" | "push" | "pending";
  dogValue?: number;
};

/** Preview-only fixture; intentionally isolated from live pick and settlement flows. */
export function buildTestWeek(profiles: Profile[], currentUserId: string) {
  const previewNow = Date.now();
  const previewTime = (minutesFromNow: number) => new Date(previewNow + minutesFromNow * 60_000).toISOString();
  const games: Game[] = [
    {
      id: "test-virginia-nc-state", week: 3, league: "CFB", commence_time: previewTime(240),
      away_team: "Virginia Cavaliers", home_team: "NC State Wolfpack",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/258.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/152.png",
      current_spread_team: "NC State Wolfpack", current_spread: -10.5, current_bookmaker: "Test line",
      lock_time: previewTime(-120), is_locked: true, final_away_score: null, final_home_score: null,
      live_away_score: null, live_home_score: null, live_status: null, live_state: "pre", live_completed: false
    },
    {
      id: "test-raiders-broncos", week: 3, league: "NFL", commence_time: previewTime(360),
      away_team: "Las Vegas Raiders", home_team: "Denver Broncos",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/nfl/500/13.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/nfl/500/7.png",
      current_spread_team: "Denver Broncos", current_spread: -7.5, current_bookmaker: "Test line",
      lock_time: previewTime(-120), is_locked: true, final_away_score: null, final_home_score: null,
      live_away_score: null, live_home_score: null, live_status: null, live_state: "pre", live_completed: false
    },
    {
      id: "test-sjsu-fresno", week: 3, league: "CFB", commence_time: previewTime(-50),
      away_team: "San Jose State Spartans", home_team: "Fresno State Bulldogs",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/23.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/278.png",
      current_spread_team: "Fresno State Bulldogs", current_spread: -10.5, current_bookmaker: "Test line",
      lock_time: previewTime(-180), is_locked: true, final_away_score: null, final_home_score: null,
      live_away_score: 13, live_home_score: 34, live_status: "4th 4:12", live_state: "in", live_completed: false,
      live_possession_team: "Fresno State Bulldogs", live_situation: "2nd & 5 at SJSU 22",
      live_down: 2, live_distance: 5, live_yards_to_goal: 22, live_away_timeouts: 2, live_home_timeouts: 3
    },
    {
      id: "test-giants-eagles", week: 3, league: "NFL", commence_time: previewTime(-80),
      away_team: "New York Giants", home_team: "Philadelphia Eagles",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/nfl/500/19.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/nfl/500/21.png",
      current_spread_team: "Philadelphia Eagles", current_spread: -8.5, current_bookmaker: "Test line",
      lock_time: previewTime(-180), is_locked: true, final_away_score: null, final_home_score: null,
      live_away_score: 13, live_home_score: 24, live_status: "4th 9:16", live_state: "in", live_completed: false,
      live_possession_team: "New York Giants", live_situation: "3rd & 7 at NYG 42",
      live_down: 3, live_distance: 7, live_yards_to_goal: 58, live_away_timeouts: 3, live_home_timeouts: 2
    },
    {
      id: "test-iowa-rutgers", week: 3, league: "CFB", commence_time: "2026-09-12T00:00:00.000Z",
      away_team: "Rutgers Scarlet Knights", home_team: "Iowa Hawkeyes",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/164.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/2294.png",
      current_spread_team: "Iowa Hawkeyes", current_spread: -7.5, current_bookmaker: "Test line",
      lock_time: "2026-09-11T00:00:00.000Z", is_locked: true, final_away_score: 17, final_home_score: 27
    },
    {
      id: "test-unc-tcu", week: 3, league: "CFB", commence_time: "2026-09-12T16:00:00.000Z",
      away_team: "North Carolina Tar Heels", home_team: "TCU Horned Frogs",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/153.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/2628.png",
      current_spread_team: "TCU Horned Frogs", current_spread: -6.5, current_bookmaker: "Test line",
      lock_time: "2026-09-11T23:00:00.000Z", is_locked: true, final_away_score: 24, final_home_score: 27
    },
    {
      id: "test-cowboys-chiefs", week: 3, league: "NFL", commence_time: "2026-09-13T17:00:00.000Z",
      away_team: "Dallas Cowboys", home_team: "Kansas City Chiefs",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/nfl/500/6.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/nfl/500/12.png",
      current_spread_team: "Kansas City Chiefs", current_spread: -3, current_bookmaker: "Test line",
      lock_time: "2026-09-11T23:00:00.000Z", is_locked: true, final_away_score: 24, final_home_score: 29
    },
    {
      id: "test-texas-ohio-state", week: 3, league: "CFB", commence_time: "2026-09-13T19:30:00.000Z",
      away_team: "Texas Longhorns", home_team: "Ohio State Buckeyes",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/251.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/194.png",
      current_spread_team: "Ohio State Buckeyes", current_spread: -10.5, current_bookmaker: "Test line",
      lock_time: "2026-09-11T23:00:00.000Z", is_locked: true, final_away_score: 17, final_home_score: 31
    },
    {
      id: "test-seahawks-patriots", week: 3, league: "NFL", commence_time: "2026-09-14T00:20:00.000Z",
      away_team: "Seattle Seahawks", home_team: "New England Patriots",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/nfl/500/26.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/nfl/500/17.png",
      current_spread_team: "New England Patriots", current_spread: -2.5, current_bookmaker: "Test line",
      lock_time: "2026-09-11T23:00:00.000Z", is_locked: true, final_away_score: 20, final_home_score: 23
    },
    {
      id: "test-stanford-usc", week: 3, league: "CFB", commence_time: "2026-09-13T03:00:00.000Z",
      away_team: "Stanford Cardinal", home_team: "USC Trojans",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/24.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/30.png",
      current_spread_team: "USC Trojans", current_spread: -10.5, current_bookmaker: "Test line",
      lock_time: "2026-09-11T23:00:00.000Z", is_locked: true, final_away_score: 24, final_home_score: 21
    },
    {
      id: "test-hawaii-oregon", week: 3, league: "CFB", commence_time: "2026-09-13T22:00:00.000Z",
      away_team: "Hawaii Rainbow Warriors", home_team: "Oregon Ducks",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/62.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png",
      current_spread_team: "Oregon Ducks", current_spread: -20.5, current_bookmaker: "Test line",
      lock_time: "2026-09-11T23:00:00.000Z", is_locked: true, final_away_score: 14, final_home_score: 38
    },
    {
      id: "test-ucla-oregon", week: 3, league: "CFB", commence_time: "2026-09-14T02:00:00.000Z",
      away_team: "UCLA Bruins", home_team: "Oregon Ducks",
      away_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/26.png", home_logo_url: "https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png",
      current_spread_team: "Oregon Ducks", current_spread: -7, current_bookmaker: "Test line",
      lock_time: "2026-09-11T23:00:00.000Z", is_locked: true, final_away_score: 21, final_home_score: 28
    }
  ];

  const cards: TestPickRow[][] = [
    [
      { id: "iowa", gameId: "test-iowa-rutgers", team: "Iowa Hawkeyes", spread: -7.5, matchup: "Rutgers at Iowa", finalScore: "17-27", result: "win" },
      { id: "unc", gameId: "test-unc-tcu", team: "North Carolina Tar Heels", spread: 6.5, matchup: "North Carolina at TCU", finalScore: "24-27", result: "win" },
      { id: "chiefs", gameId: "test-cowboys-chiefs", team: "Kansas City Chiefs", spread: -3, matchup: "Cowboys at Chiefs", finalScore: "24-29", result: "win" },
      { id: "ohio-state", gameId: "test-texas-ohio-state", team: "Ohio State Buckeyes", spread: -10.5, matchup: "Texas at Ohio State", finalScore: "17-31", result: "win" },
      { id: "patriots", gameId: "test-seahawks-patriots", team: "New England Patriots", spread: -2.5, matchup: "Seahawks at Patriots", finalScore: "20-23", result: "win" },
      { id: "stanford-dog", gameId: "test-stanford-usc", team: "Stanford Cardinal", spread: 10.5, matchup: "Stanford at USC", finalScore: "24-21", result: "win", dogValue: 2 }
    ],
    [
      { id: "iowa", gameId: "test-iowa-rutgers", team: "Iowa Hawkeyes", spread: -7.5, matchup: "Rutgers at Iowa", finalScore: "17-27", result: "win" },
      { id: "unc", gameId: "test-unc-tcu", team: "North Carolina Tar Heels", spread: 6.5, matchup: "North Carolina at TCU", finalScore: "24-27", result: "win" },
      { id: "chiefs", gameId: "test-cowboys-chiefs", team: "Kansas City Chiefs", spread: -3, matchup: "Cowboys at Chiefs", finalScore: "24-29", result: "win" },
      { id: "ohio-state", gameId: "test-texas-ohio-state", team: "Ohio State Buckeyes", spread: -10.5, matchup: "Texas at Ohio State", finalScore: "17-31", result: "win" },
      { id: "patriots", gameId: "test-seahawks-patriots", team: "New England Patriots", spread: -2.5, matchup: "Seahawks at Patriots", finalScore: "20-23", result: "win" },
      { id: "hawaii-dog", gameId: "test-hawaii-oregon", team: "Hawaii Rainbow Warriors", spread: 20.5, matchup: "Hawaii at Oregon", finalScore: "14-38", result: "loss", dogValue: 3 }
    ],
    [
      { id: "iowa", gameId: "test-iowa-rutgers", team: "Iowa Hawkeyes", spread: -7.5, matchup: "Rutgers at Iowa", finalScore: "17-27", result: "win" },
      { id: "tcu", gameId: "test-unc-tcu", team: "TCU Horned Frogs", spread: -6.5, matchup: "North Carolina at TCU", finalScore: "24-27", result: "loss" },
      { id: "cowboys", gameId: "test-cowboys-chiefs", team: "Dallas Cowboys", spread: 3, matchup: "Cowboys at Chiefs", finalScore: "24-29", result: "loss" },
      { id: "ohio-state", gameId: "test-texas-ohio-state", team: "Ohio State Buckeyes", spread: -10.5, matchup: "Texas at Ohio State", finalScore: "17-31", result: "win" },
      { id: "ucla", gameId: "test-ucla-oregon", team: "UCLA Bruins", spread: 7, matchup: "UCLA at Oregon", finalScore: "21-28", result: "push" },
      { id: "hawaii-dog", gameId: "test-hawaii-oregon", team: "Hawaii Rainbow Warriors", spread: 20.5, matchup: "Hawaii at Oregon", finalScore: "14-38", result: "loss", dogValue: 3 }
    ]
  ];

  const playerCards = profiles.slice(0, 3).map((profile, profileIndex) => {
    const baseRows = cards[profileIndex] || [];
    const rows = profile.id === currentUserId ? [
      { id: "fresno-live-possession", gameId: "test-sjsu-fresno", team: "Fresno State Bulldogs", spread: -10.5, matchup: "San Jose State at Fresno State", finalScore: "", result: "pending" as const },
      { id: "eagles-live-defense", gameId: "test-giants-eagles", team: "Philadelphia Eagles", spread: -8.5, matchup: "New York Giants at Philadelphia", finalScore: "", result: "pending" as const },
      ...baseRows.slice(2)
    ] : baseRows;
    const picks = rows.map((row, pickIndex): Pick => ({
      id: `test-${profile.id}-${pickIndex}`,
      user_id: profile.id,
      game_id: row.gameId,
      week: 3,
      selected_team: row.team,
      pick_type: row.dogValue ? "underdog" : "regular",
      status: "locked",
      locked_spread: row.spread,
      locked_spread_team: row.team,
      locked_at: "2026-09-11T00:00:00.000Z",
      underdog_win_value: row.dogValue || null,
      result: row.result,
      game: games.find((game) => game.id === row.gameId)
    }));
    return { profile, rows, picks };
  });

  const picks = playerCards.flatMap((card) => card.picks);
  const standings = computeWeeklyStandings(profiles, picks);
  const settlement = computeWeeklySettlement(standings, true);
  const bankEntries: BankEntry[] = standings.map((row) => ({
    id: `test-entry-${row.user_id}`,
    week: 3,
    user_id: row.user_id,
    amount: settlement.amounts.get(row.user_id) || 0,
    note: settlement.notes.get(row.user_id) || "Test week settlement",
    profile: { display_name: row.display_name }
  }));

  const sideBets: SideBet[] = profiles.length >= 2 ? [{
    id: "test-side-bet-settled",
    creator_id: profiles[0].id,
    game_id: "test-cowboys-chiefs",
    week: 3,
    creator_team: "Dallas Cowboys",
    offered_team: "Kansas City Chiefs",
    creator_spread: 6,
    offered_spread: -6,
    amount: 25,
    status: "settled",
    accepted_by: profiles[1].id,
    accepted_at: "2026-09-11T18:00:00.000Z",
    winner_id: profiles[0].id,
    result: "creator_win",
    created_at: "2026-09-11T17:30:00.000Z",
    updated_at: "2026-09-13T21:00:00.000Z",
    game: games.find((game) => game.id === "test-cowboys-chiefs"),
    creator: { id: profiles[0].id, display_name: profiles[0].display_name },
    accepted_by_profile: { id: profiles[1].id, display_name: profiles[1].display_name },
    targets: [{
      side_bet_id: "test-side-bet-settled",
      recipient_id: profiles[1].id,
      response: "accepted",
      responded_at: "2026-09-11T18:00:00.000Z",
      recipient: { id: profiles[1].id, display_name: profiles[1].display_name }
    }]
  }] : [];
  const sideBetBankTotals = Object.fromEntries(profiles.map((profile) => [profile.id, 0]));
  if (profiles.length >= 2) {
    sideBetBankTotals[profiles[0].id] = 25;
    sideBetBankTotals[profiles[1].id] = -25;
  }

  return { games, playerCards, picks, standings, settlement, bankEntries, sideBets, sideBetBankTotals };
}

