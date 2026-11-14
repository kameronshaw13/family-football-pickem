-- Keep a verified point spread when a scheduler or provider returns a null market.
-- Once a game has locked, its published spread must stay immutable.
create or replace function public.preserve_existing_game_spreads()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.current_spread is not null
     and old.current_spread_team is not null
     and (new.current_spread is null or new.current_spread_team is null or old.is_locked) then
    new.current_spread := old.current_spread;
    new.current_spread_team := old.current_spread_team;
    new.current_bookmaker := old.current_bookmaker;
  end if;
  return new;
end;
$$;
drop trigger if exists preserve_existing_game_spreads_before_update on public.games;
create trigger preserve_existing_game_spreads_before_update
before update on public.games
for each row execute function public.preserve_existing_game_spreads();
