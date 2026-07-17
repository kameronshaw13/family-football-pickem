export type League = "NFL" | "CFB";
export type PickStatus = "draft" | "locked";
export type PickResult = "win" | "loss" | "push" | "pending";
export type PickType = "regular" | "underdog";

export type Game = {
  id: string;
  week: number;
  league: League;
  commence_time: string;
  home_team: string;
  away_team: string;
  home_logo_url: string | null;
  away_logo_url: string | null;
  current_spread_team: string | null;
  current_spread: number | null;
  current_bookmaker: string | null;
  lock_time: string;
  is_locked: boolean;
  final_home_score: number | null;
  final_away_score: number | null;
  created_at?: string;
  updated_at?: string;
};

export type Pick = {
  id: string;
  user_id: string;
  game_id: string;
  week: number;
  selected_team: string;
  pick_type: PickType;
  status: PickStatus;
  locked_spread: number | null;
  locked_spread_team: string | null;
  locked_at: string | null;
  underdog_win_value: number | null;
  result: PickResult;
  created_at?: string;
  updated_at?: string;
  game?: Game;
  profile?: Profile;
};

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  is_admin: boolean;
};

export type Standing = {
  user_id: string;
  display_name: string;
  wins: number;
  losses: number;
  pushes: number;
  win_pct: number;
};

export type WeekRule = {
  week: number;
  label: string;
  phase: "opening" | "college" | "mixed" | "nfl";
  regularTotal: number;
  cfbMinimum: number;
  nflMinimum: number;
  underdogTotal: number;
  perfectBonus: boolean;
};

export type BankSettings = {
  id: number;
  winner_amount: number;
  loser_amount: number;
  updated_at?: string;
};

export type BankEntry = {
  id: string;
  week: number;
  user_id: string;
  amount: number;
  note: string | null;
  created_at?: string;
  profile?: { display_name: string } | null;
};

export type SideBetStatus = "open" | "accepted" | "declined" | "cancelled" | "expired" | "settled";
export type SideBetResult = "pending" | "creator_win" | "acceptor_win" | "push";
export type SideBetTargetResponse = "pending" | "accepted" | "declined" | "closed";
export type ProfileSummary = { id: string; display_name: string };

export type SideBetTarget = {
  side_bet_id: string;
  recipient_id: string;
  response: SideBetTargetResponse;
  responded_at: string | null;
  recipient?: ProfileSummary | null;
};

export type SideBet = {
  id: string;
  creator_id: string;
  game_id: string;
  week: number;
  creator_team: string;
  offered_team: string;
  creator_spread: number;
  offered_spread: number;
  amount: number;
  status: SideBetStatus;
  accepted_by: string | null;
  accepted_at: string | null;
  winner_id: string | null;
  result: SideBetResult;
  created_at: string;
  updated_at: string;
  game?: Game;
  creator?: ProfileSummary | null;
  accepted_by_profile?: ProfileSummary | null;
  targets?: SideBetTarget[];
};
