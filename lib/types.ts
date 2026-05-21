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
  regularTotal: number;
  cfbRequired: number;
  nflRequired: number;
  underdogTotal: number;
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
