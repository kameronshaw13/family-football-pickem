-- Retain past winning/losing records while starting a new weekly bank period.
-- Only the server (service_role) reads these balances; no direct client grants.
create table if not exists public.bank_resets (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.pickem_groups(id) on delete cascade,
  season_year integer not null,
  week integer not null check (week >= 0),
  user_id uuid not null references public.profiles(id) on delete cascade,
  opening_balance numeric(12,2) not null default 0,
  note text not null default 'Opening balance',
  created_at timestamptz not null default now(),
  unique (group_id, season_year, week, user_id)
);
create index if not exists bank_resets_group_week_idx on public.bank_resets (group_id, season_year, week desc);
alter table public.bank_resets enable row level security;
revoke all on public.bank_resets from anon, authenticated;
grant select on public.bank_resets to service_role;
