-- Private record of authenticated Shaw/Friends Pick'em visits. Only the server writes
-- or reads this table; no member-facing API exposes its contents.
create table if not exists public.app_open_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.pickem_groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  open_window timestamptz not null,
  opened_at timestamptz not null default now(),
  unique (group_id, profile_id, open_window)
);

create index if not exists app_open_events_group_time_idx
  on public.app_open_events (group_id, opened_at desc);

alter table public.app_open_events enable row level security;
revoke all on public.app_open_events from anon, authenticated;
grant select, insert on public.app_open_events to service_role;
