-- Keep Mississippi Valley State's displayed school name canonical even when
-- upstream feeds return the full "Mississippi Valley State Delta Devils" name.
-- Applied to production on 2026-08-19.

create or replace function public.normalize_pickem_game_team_names()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if lower(trim(coalesce(new.away_team, ''))) in ('mississippi valley state delta devils', 'mississippi valley state delta') then
    new.away_team := 'Mississippi Valley State';
  end if;
  if lower(trim(coalesce(new.home_team, ''))) in ('mississippi valley state delta devils', 'mississippi valley state delta') then
    new.home_team := 'Mississippi Valley State';
  end if;
  if lower(trim(coalesce(new.current_spread_team, ''))) in ('mississippi valley state delta devils', 'mississippi valley state delta') then
    new.current_spread_team := 'Mississippi Valley State';
  end if;
  return new;
end;
$$;

revoke all on function public.normalize_pickem_game_team_names() from public, anon, authenticated;

drop trigger if exists normalize_pickem_game_team_names on public.games;
create trigger normalize_pickem_game_team_names
before insert or update of away_team, home_team, current_spread_team
on public.games
for each row execute function public.normalize_pickem_game_team_names();

update public.games
set away_team = case when lower(trim(away_team)) in ('mississippi valley state delta devils', 'mississippi valley state delta') then 'Mississippi Valley State' else away_team end,
    home_team = case when lower(trim(home_team)) in ('mississippi valley state delta devils', 'mississippi valley state delta') then 'Mississippi Valley State' else home_team end,
    current_spread_team = case when lower(trim(coalesce(current_spread_team, ''))) in ('mississippi valley state delta devils', 'mississippi valley state delta') then 'Mississippi Valley State' else current_spread_team end
where lower(trim(away_team)) in ('mississippi valley state delta devils', 'mississippi valley state delta')
   or lower(trim(home_team)) in ('mississippi valley state delta devils', 'mississippi valley state delta')
   or lower(trim(coalesce(current_spread_team, ''))) in ('mississippi valley state delta devils', 'mississippi valley state delta');

update public.picks
set selected_team = 'Mississippi Valley State'
where lower(trim(selected_team)) in ('mississippi valley state delta devils', 'mississippi valley state delta');

update public.side_bets
set creator_team = case when lower(trim(creator_team)) in ('mississippi valley state delta devils', 'mississippi valley state delta') then 'Mississippi Valley State' else creator_team end,
    offered_team = case when lower(trim(offered_team)) in ('mississippi valley state delta devils', 'mississippi valley state delta') then 'Mississippi Valley State' else offered_team end
where lower(trim(creator_team)) in ('mississippi valley state delta devils', 'mississippi valley state delta')
   or lower(trim(offered_team)) in ('mississippi valley state delta devils', 'mississippi valley state delta');

update public.odds_snapshots
set spread_team = 'Mississippi Valley State'
where lower(trim(spread_team)) in ('mississippi valley state delta devils', 'mississippi valley state delta');
