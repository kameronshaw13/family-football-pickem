begin;

-- Retain a service-only restoration copy of the premature automatic penalties.
create table if not exists public.maintenance_backups (
  id text primary key,
  created_at timestamptz not null default now(),
  reason text not null,
  payload jsonb not null
);
alter table public.maintenance_backups enable row level security;
revoke all on public.maintenance_backups from anon, authenticated;
grant all on public.maintenance_backups to service_role;

do $$
declare
  basketball_group uuid;
  season integer;
begin
  select id, current_season_year into basketball_group, season
  from public.pickem_groups where slug = 'friends-basketball';
  if basketball_group is null then raise exception 'Basketball group is missing'; end if;
  if exists (select 1 from public.maintenance_backups where id='friends_basketball_november_2026_launch') then return; end if;
  -- Abort rather than silently reassign a real submitted card or money entry.
  if exists (
    select 1 from public.picks p left join public.games g on g.id=p.game_id
    where p.group_id=basketball_group and p.season_year=season
      and (p.week<>1 or g.id not like 'admin-%' or g.id is null
        or p.selected_team not in ('No Pick Submitted','No Dog Submitted'))
  ) then raise exception 'Real basketball picks require an explicit calendar migration'; end if;
  if exists (select 1 from public.side_bets where group_id=basketball_group and season_year=season)
    or exists (select 1 from public.bank_entries where group_id=basketball_group and season_year=season
      and (week<>1 or amount<>0 or note<>'Week 1 payout · tie split'))
  then raise exception 'Real basketball activity requires an explicit calendar migration'; end if;

  insert into public.maintenance_backups(id,reason,payload)
  values ('friends_basketball_november_2026_launch',
    'Basketball begins November 1; reverse only premature automatic missed picks and zero-dollar settlements.',
    jsonb_build_object(
      'group_id',basketball_group,'season_year',season,
      'season',(select to_jsonb(s) from public.group_seasons s where s.group_id=basketball_group and s.season_year=season),
      'picks',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from public.picks p where p.group_id=basketball_group and p.season_year=season),
      'bank_entries',(select coalesce(jsonb_agg(to_jsonb(b)),'[]'::jsonb) from public.bank_entries b where b.group_id=basketball_group and b.season_year=season)
    ));

  delete from public.picks where group_id=basketball_group and season_year=season;
  delete from public.bank_entries where group_id=basketball_group and season_year=season and amount=0;
  update public.group_seasons set rules=jsonb_set(
    jsonb_set(rules,'{calendar,startDate}','"2026-11-01"'::jsonb),
    '{pickRules,weekOverrides}','{}'::jsonb)
  where group_id=basketball_group and season_year=season;

  update public.games set week=case
      when (commence_time at time zone 'America/Chicago')::date < date '2026-11-09' then 1
      else 2+(((commence_time at time zone 'America/Chicago')::date-date '2026-11-09')/7)
    end, updated_at=now()
  where league in ('CBB','NBA') and commence_time>='2026-11-01T05:00:00Z' and commence_time<'2027-04-12T05:00:00Z';
end $$;
commit;
