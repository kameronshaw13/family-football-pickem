
alter table public.games add column if not exists schedule_source_updated_at timestamptz;
alter table public.games add column if not exists spread_source_updated_at timestamptz;

create or replace function public.preserve_existing_game_spreads()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.current_spread is not null and old.current_spread_team is not null
    and (new.current_spread is null or new.current_spread_team is null or old.is_locked) then
    new.current_spread := old.current_spread;
    new.current_spread_team := old.current_spread_team;
    new.current_bookmaker := old.current_bookmaker;
    new.spread_source_updated_at := old.spread_source_updated_at;
  end if;

  -- A delayed/rescheduled game can change kickoff, but cannot silently unlock
  -- an existing locked game, move locked picks to another week, or relock
  -- already committed selections under a changed deadline.
  if old.is_locked then
    new.is_locked := true;
    new.lock_time := old.lock_time;
    new.week := old.week;
  end if;

  -- Once picks or bets reference this game ID, the matchup identity is immutable.
  -- Keep the ID stable across provider reschedules and renaming glitches.
  if (old.home_team is distinct from new.home_team or
      old.away_team is distinct from new.away_team or
      old.league is distinct from new.league) and
     (exists (select 1 from public.picks p where p.game_id = old.id) or
      exists (select 1 from public.side_bets b where b.game_id = old.id)) then
    new.home_team := old.home_team;
    new.away_team := old.away_team;
    new.league := old.league;
  end if;
  return new;
end;
$$;

create or replace function app_integrity.record_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  changed_record jsonb;
  record_id text;
begin
  if tg_op = 'UPDATE' and
     ((to_jsonb(old) - 'updated_at' - 'created_at' -
       'home_logo_url' - 'away_logo_url' - 'home_rank' - 'away_rank' -
       'schedule_source_updated_at' - 'spread_source_updated_at')
      = (to_jsonb(new) - 'updated_at' - 'created_at' -
       'home_logo_url' - 'away_logo_url' - 'home_rank' - 'away_rank' -
       'schedule_source_updated_at' - 'spread_source_updated_at')) then
    return new;
  end if;
  changed_record := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  record_id := coalesce(changed_record->>'id', concat_ws(':',
    changed_record->>'group_id', changed_record->>'game_id',
    changed_record->>'season_year'));
  if tg_op = 'DELETE' then
    insert into app_integrity.change_history(table_name,row_id,operation,old_row)
      values(tg_table_name,record_id,tg_op,to_jsonb(old));
    return old;
  end if;
  insert into app_integrity.change_history(table_name,row_id,operation,old_row,new_row)
    values(tg_table_name,record_id,tg_op,
      case when tg_op='UPDATE' then to_jsonb(old) else null end,
      to_jsonb(new));
  return new;
end;
$$;
revoke all on function app_integrity.record_change() from public, anon, authenticated;
drop trigger if exists record_group_game_line_changes on public.group_game_lines;
create trigger record_group_game_line_changes
after insert or update or delete on public.group_game_lines
for each row execute function app_integrity.record_change();

