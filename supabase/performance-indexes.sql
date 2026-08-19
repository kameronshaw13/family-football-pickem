-- Production performance indexes applied August 19, 2026.
-- These cover the hot paths used by live game locking and side-bet slot/status reads.

create index if not exists idx_games_unlocked_commence
  on public.games (commence_time)
  where is_locked = false;

create index if not exists idx_side_bets_week_status
  on public.side_bets (week, status);

create index if not exists idx_side_bet_targets_recipient_response
  on public.side_bet_targets (recipient_id, response);
