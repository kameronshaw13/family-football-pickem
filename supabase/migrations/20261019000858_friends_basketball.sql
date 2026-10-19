-- Friends basketball is a separate league. Accounts/roster are shared; no
-- football picks, bets, balances, deposits, notifications or results are copied.
begin;

alter table public.games drop constraint if exists games_league_check;
alter table public.games add constraint games_league_check check (league in ('NFL', 'CFB', 'CBB', 'NBA'));
alter table public.odds_snapshots drop constraint if exists odds_snapshots_league_check;
alter table public.odds_snapshots add constraint odds_snapshots_league_check check (league in ('NFL', 'CFB', 'CBB', 'NBA'));

insert into public.pickem_groups (slug, name, short_name, current_season_year, timezone, is_default, is_active, branding)
select 'friends-basketball', 'Friends Basketball Pick''em', 'Friends Basketball', current_season_year, timezone, false, true, branding
from public.pickem_groups where slug = 'friends'
on conflict (slug) do nothing;

insert into public.group_members (group_id, profile_id, role, status)
select basketball.id, member.profile_id, member.role, member.status
from public.pickem_groups football
join public.group_members member on member.group_id = football.id
cross join public.pickem_groups basketball
where football.slug = 'friends' and basketball.slug = 'friends-basketball'
on conflict (group_id, profile_id) do nothing;

insert into public.group_seasons (group_id, season_year, status, rules)
select basketball.id, football.current_season_year, 'active',
  (season.rules - 'excludedTeams' - 'weekOpenOverrides' - 'locks' - 'season') || jsonb_build_object(
    'sport', 'basketball',
    'eligibleLeagues', jsonb_build_array('CBB', 'NBA'),
    'excludedTeams', jsonb_build_array(),
    'weekOpenOverrides', '{}'::jsonb,
    'calendar', jsonb_build_object(
      'startDate', '2026-10-19',
      'endDateExclusive', '2027-04-12',
      'tournamentStartDate', '2027-03-15',
      'tournamentEndDateExclusive', '2027-04-12'
    ),
    'locks', jsonb_build_object('minutesBeforeTipoff', 60),
    'season', jsonb_build_object('includeCbbPostseason', true, 'includeNbaPlayoffs', false)
  )
from public.pickem_groups football
join public.group_seasons season on season.group_id = football.id and season.season_year = football.current_season_year
cross join public.pickem_groups basketball
where football.slug = 'friends' and basketball.slug = 'friends-basketball'
on conflict (group_id, season_year) do nothing;

commit;
