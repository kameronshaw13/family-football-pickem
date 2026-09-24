-- Shared indexes for all groups. No rules or member data are changed.
set lock_timeout = '5s';
create index if not exists idx_odds_snapshots_game_id on public.odds_snapshots (game_id);
create index if not exists idx_side_bet_dismissals_group_id on public.side_bet_dismissals (group_id);
create index if not exists idx_side_bets_winner_id on public.side_bets (winner_id);
