-- Distinguish a general league opening from an intentional League Cards view.
-- Existing rows remain league_open; each view gets its own timestamped event.
alter table public.app_open_events
  add column if not exists event_type text not null default 'league_open';
alter table public.app_open_events
  drop constraint if exists app_open_events_event_type_check;
alter table public.app_open_events
  add constraint app_open_events_event_type_check
  check (event_type in ('league_open', 'league_card_view'));
create index if not exists app_open_events_group_event_time_idx
  on public.app_open_events (group_id, event_type, opened_at desc);
