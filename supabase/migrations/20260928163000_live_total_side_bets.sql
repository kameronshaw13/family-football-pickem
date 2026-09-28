alter table public.side_bets
  add column if not exists offer_type text not null default 'pregame',
  add column if not exists total_line numeric,
  add column if not exists creator_total_side text;

alter table public.side_bets drop constraint if exists side_bets_market_type_check;
alter table public.side_bets
  add constraint side_bets_market_type_check
  check (market_type in ('spread', 'moneyline', 'total'));

do $$
begin
  alter table public.side_bets
    add constraint side_bets_offer_type_check
    check (offer_type in ('pregame', 'live'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.side_bets
    add constraint side_bets_creator_total_side_check
    check (creator_total_side is null or creator_total_side in ('over', 'under'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.side_bets
    add constraint side_bets_total_fields_check
    check (
      market_type <> 'total'
      or (total_line is not null and total_line >= 0 and creator_total_side in ('over', 'under'))
    );
exception when duplicate_object then null;
end $$;
