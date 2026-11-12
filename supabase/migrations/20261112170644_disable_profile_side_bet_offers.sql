-- A profile can view Side Bets while being unable to originate offers.
-- Separate from the existing auto-decline incoming-offers flag.
alter table public.profiles
  add column if not exists side_bet_offers_disabled boolean not null default false;

update public.profiles
  set side_bet_offers_disabled = true
where lower(username) = 'kameron';

-- Enforce at the database as well as in the normal and batch API routes.
create or replace function public.reject_disabled_side_bet_offers()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.profiles
    where id = new.creator_id and side_bet_offers_disabled
  ) then
    raise exception 'Side bets are disabled for you.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_disabled_side_bet_offers_insert on public.side_bets;
create trigger reject_disabled_side_bet_offers_insert
before insert on public.side_bets
for each row
execute function public.reject_disabled_side_bet_offers();

revoke all on function public.reject_disabled_side_bet_offers() from public, anon, authenticated;
