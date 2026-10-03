alter table public.side_bets
  add column if not exists live_score_candidate_total integer,
  add column if not exists live_score_candidate_seen_at timestamptz;
