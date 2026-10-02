alter table if exists public.side_bets
  add column if not exists live_offer_home_score integer,
  add column if not exists live_offer_away_score integer;
