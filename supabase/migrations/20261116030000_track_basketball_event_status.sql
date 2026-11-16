alter table public.games add column if not exists event_status text;

create or replace function public.preserve_existing_game_spreads()
returns trigger language plpgsql set search_path = ''
as $$
declare
  has_dependents boolean;
  movable_basketball_game boolean;
begin
  has_dependents := exists (select 1 from public.picks p where p.game_id = old.id)
    or exists (select 1 from public.side_bets b where b.game_id = old.id);
  movable_basketball_game := old.league in ('CBB', 'NBA')
    and old.commence_time is distinct from new.commence_time
    and not has_dependents;

  if old.current_spread is not null and old.current_spread_team is not null
    and not (movable_basketball_game and new.current_spread is null)
    and (new.current_spread is null or new.current_spread_team is null or old.is_locked) then
    new.current_spread := old.current_spread;
    new.current_spread_team := old.current_spread_team;
    new.current_bookmaker := old.current_bookmaker;
    new.spread_source_updated_at := old.spread_source_updated_at;
  end if;

  -- Unreferenced basketball events may move to their real date and week.
  -- Existing picks and side bets keep their original lock and identity.
  if old.is_locked and not movable_basketball_game then
    new.is_locked := true;
    new.lock_time := old.lock_time;
    new.week := old.week;
  end if;

  if (old.home_team is distinct from new.home_team or
      old.away_team is distinct from new.away_team or
      old.league is distinct from new.league) and has_dependents then
    new.home_team := old.home_team;
    new.away_team := old.away_team;
    new.league := old.league;
  end if;
  return new;
end;
$$;
