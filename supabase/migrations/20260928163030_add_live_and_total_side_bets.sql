alter table public.side_bets
  add column if not exists offer_phase text not null default 'pregame',
  add column if not exists total_points numeric,
  add column if not exists creator_total_side text;

alter table public.side_bets drop constraint if exists side_bets_market_type_check;
alter table public.side_bets drop constraint if exists side_bets_offer_phase_check;
alter table public.side_bets drop constraint if exists side_bets_total_side_check;
alter table public.side_bets drop constraint if exists side_bets_total_fields_check;

alter table public.side_bets
  add constraint side_bets_market_type_check check (market_type in ('spread','moneyline','total')),
  add constraint side_bets_offer_phase_check check (offer_phase in ('pregame','live')),
  add constraint side_bets_total_side_check check (creator_total_side is null or creator_total_side in ('over','under')),
  add constraint side_bets_total_fields_check check (
    (market_type = 'total' and total_points is not null and creator_total_side in ('over','under'))
    or market_type <> 'total'
  );
