begin;

alter table public.group_week_money
  add column if not exists submitted_at timestamptz;

alter table public.group_season_money
  add column if not exists submitted_at timestamptz;

update public.pickem_groups
set branding = coalesce(branding, '{}'::jsonb) || '{"theme":"shaw-retro","headerMode":"football","headerLabel":"Football Pick’em","icon":"football"}'::jsonb
where slug in ('friends', 'other-family');

update public.group_seasons as season
set rules = jsonb_set(
  jsonb_set(
    jsonb_set(
      season.rules,
      '{sideBets}',
      coalesce(season.rules -> 'sideBets', '{}'::jsonb) || '{"maxAmount":20,"maxPerWeek":null,"amountEntry":"fixed"}'::jsonb
    ),
    '{weeklyBank}',
    coalesce(season.rules -> 'weeklyBank', '{}'::jsonb) || '{"winner":25,"fourth":-10,"fifth":-15,"tieRules":"position_average"}'::jsonb
  ),
  '{seasonPrizes}',
  coalesce(season.rules -> 'seasonPrizes', '{}'::jsonb) || '{"first":150,"second":50,"third":-30,"fourth":-70,"fifth":-100,"tieRules":"position_average"}'::jsonb
)
from public.pickem_groups as pickem_group
where pickem_group.id = season.group_id
  and pickem_group.slug = 'friends'
  and season.status = 'active';

update public.group_seasons as season
set rules = jsonb_set(
  jsonb_set(
    season.rules,
    '{sideBets}',
    coalesce(season.rules -> 'sideBets', '{}'::jsonb) || '{"maxAmount":20,"maxPerWeek":null,"amountEntry":"fixed"}'::jsonb
  ),
  '{excludedTeams}',
  '[]'::jsonb
)
from public.pickem_groups as pickem_group
where pickem_group.id = season.group_id
  and pickem_group.slug = 'other-family'
  and season.status = 'active';

create or replace function public.submit_group_money(
  p_group_id uuid,
  p_season_year integer,
  p_week integer,
  p_weekly_amount numeric,
  p_season_amount numeric,
  p_updated_by uuid
)
returns table (
  weekly_amount numeric,
  season_amount numeric,
  weekly_submitted boolean,
  season_submitted boolean
)
language plpgsql
set search_path = public
as $$
declare
  existing_week_submitted_at timestamptz;
  existing_season_submitted_at timestamptz;
  stored_season_amount numeric;
  affected_rows integer;
  submitted_time timestamptz := now();
begin
  if p_week < 1 or p_week > 20 then
    raise exception 'Week must be between 1 and 20.';
  end if;

  select money.submitted_at
  into existing_week_submitted_at
  from public.group_week_money as money
  where money.group_id = p_group_id
    and money.season_year = p_season_year
    and money.week = p_week
  for update;

  if existing_week_submitted_at is not null then
    raise exception 'The Week % pot is already submitted and locked.', p_week;
  end if;

  select money.submitted_at, money.winner_take_all_amount
  into existing_season_submitted_at, stored_season_amount
  from public.group_season_money as money
  where money.group_id = p_group_id
    and money.season_year = p_season_year
  for update;

  if p_week <> 1 and p_season_amount is not null then
    raise exception 'The season pot can only be submitted during Week 1.';
  end if;
  if p_week = 1 and existing_season_submitted_at is null and p_season_amount is null then
    raise exception 'Submit the season pot with the Week 1 pot.';
  end if;

  insert into public.group_week_money (
    group_id, season_year, week, winner_take_all_amount, updated_by, updated_at, submitted_at
  ) values (
    p_group_id, p_season_year, p_week, p_weekly_amount, p_updated_by, submitted_time, submitted_time
  )
  on conflict (group_id, season_year, week) do update
  set winner_take_all_amount = excluded.winner_take_all_amount,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at,
      submitted_at = excluded.submitted_at
  where public.group_week_money.submitted_at is null;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'The Week % pot is already submitted and locked.', p_week;
  end if;

  if p_week = 1 and existing_season_submitted_at is null then
    insert into public.group_season_money (
      group_id, season_year, winner_take_all_amount, updated_by, updated_at, submitted_at
    ) values (
      p_group_id, p_season_year, p_season_amount, p_updated_by, submitted_time, submitted_time
    )
    on conflict (group_id, season_year) do update
    set winner_take_all_amount = excluded.winner_take_all_amount,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at,
        submitted_at = excluded.submitted_at
    where public.group_season_money.submitted_at is null;

    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      raise exception 'The season pot is already submitted and locked.';
    end if;
    stored_season_amount := p_season_amount;
    existing_season_submitted_at := submitted_time;
  end if;

  return query select
    p_weekly_amount,
    coalesce(stored_season_amount, 0),
    true,
    existing_season_submitted_at is not null;
end;
$$;

revoke all on function public.submit_group_money(uuid, integer, integer, numeric, numeric, uuid) from public, anon, authenticated;
grant execute on function public.submit_group_money(uuid, integer, integer, numeric, numeric, uuid) to service_role;

commit;
