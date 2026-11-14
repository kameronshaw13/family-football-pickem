
create schema if not exists app_integrity;
revoke all on schema app_integrity from public, anon, authenticated;

create table if not exists app_integrity.change_history (
  id bigint generated always as identity primary key,
  changed_at timestamptz not null default clock_timestamp(),
  table_name text not null,
  row_id text not null,
  operation text not null,
  old_row jsonb,
  new_row jsonb
);
create index if not exists change_history_lookup_idx
  on app_integrity.change_history(table_name,row_id,changed_at desc);
revoke all on app_integrity.change_history from public, anon, authenticated;

create or replace function app_integrity.record_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and
    ((to_jsonb(old) - 'updated_at' - 'home_logo_url' - 'away_logo_url' - 'home_rank' - 'away_rank')
     = (to_jsonb(new) - 'updated_at' - 'home_logo_url' - 'away_logo_url' - 'home_rank' - 'away_rank'))
    then return new;
  end if;
  if tg_op = 'DELETE' then
    insert into app_integrity.change_history(table_name,row_id,operation,old_row)
    values(tg_table_name,old.id::text,tg_op,to_jsonb(old));
    return old;
  end if;
  insert into app_integrity.change_history(table_name,row_id,operation,old_row,new_row)
  values(tg_table_name,new.id::text,tg_op,
    case when tg_op='UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new));
  return new;
end;
$$;
revoke all on function app_integrity.record_change() from public, anon, authenticated;
drop trigger if exists record_pick_changes on public.picks;
create trigger record_pick_changes after insert or update or delete on public.picks
  for each row execute function app_integrity.record_change();
drop trigger if exists record_side_bet_changes on public.side_bets;
create trigger record_side_bet_changes after insert or update or delete on public.side_bets
  for each row execute function app_integrity.record_change();
drop trigger if exists record_game_changes on public.games;
create trigger record_game_changes after insert or update or delete on public.games
  for each row execute function app_integrity.record_change();

create or replace function app_integrity.capture_saturday_snapshot(p_force boolean default false)
returns text language plpgsql set search_path = ''
as $$
declare
  local_now timestamp := clock_timestamp() at time zone 'America/Chicago';
  local_year integer := extract(year from local_now)::integer;
  correct_time boolean;
  snapshot_id text;
begin
  correct_time := extract(isodow from local_now) = 6
      and extract(hour from local_now) = 10 and extract(minute from local_now) = 59;
  if not correct_time and not p_force then return 'skipped_outside_1059_ct'; end if;
  snapshot_id := (case when correct_time then 'sat_1059_ct_' else 'manual_integrity_' end)
    || to_char(local_now, 'YYYYMMDD_HH24MI');
  insert into public.maintenance_backups(id,reason,payload)
  values (
    snapshot_id,
    case when correct_time then 'Automatic Saturday 10:59 AM America/Chicago snapshot before pick lock'
      else 'Manual integrity snapshot' end,
    jsonb_build_object(
      'snapshot_version', 1,
      'captured_at', clock_timestamp(),
      'local_time_chicago', local_now,
      'picks', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from public.picks p
        where p.season_year between local_year-1 and local_year+1),
      'side_bets', (select coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb) from public.side_bets b
        where b.season_year between local_year-1 and local_year+1),
      'games', (select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) from public.games g
        where (g.commence_time >= clock_timestamp()-interval '14 days'
            and g.commence_time < clock_timestamp()+interval '21 days')
          or exists (select 1 from public.picks p where p.game_id=g.id
            and p.season_year between local_year-1 and local_year+1)
          or exists (select 1 from public.side_bets b where b.game_id=g.id
            and b.season_year between local_year-1 and local_year+1)),
      'group_game_lines', (select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb)
        from public.group_game_lines l where l.season_year between local_year-1 and local_year+1),
      'latest_odds_snapshots', (select coalesce(jsonb_agg(to_jsonb(latest)), '[]'::jsonb)
        from (select distinct on (o.game_id) o.* from public.odds_snapshots o
          join public.games g on g.id=o.game_id
          where g.commence_time >= clock_timestamp()-interval '14 days'
            and g.commence_time < clock_timestamp()+interval '21 days'
          order by o.game_id,o.created_at desc) latest)
    )
  ) on conflict(id) do nothing;
  return snapshot_id;
end;
$$;
revoke all on function app_integrity.capture_saturday_snapshot(boolean) from public, anon, authenticated;
select cron.schedule('sat-1059-chicago-pick-integrity-snapshot','59 15,16 * * 6',
  'select app_integrity.capture_saturday_snapshot();');

