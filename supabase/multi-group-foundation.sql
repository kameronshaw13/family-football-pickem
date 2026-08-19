-- Multi-group foundation applied to production on 2026-08-19.
-- Shared games/odds remain global. Group-owned competition data is scoped by group_id + season_year.

create table if not exists public.pickem_groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_name text,
  current_season_year integer not null default 2026,
  timezone text not null default 'America/Chicago',
  is_default boolean not null default false,
  is_active boolean not null default true,
  branding jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pickem_groups_one_default_idx
  on public.pickem_groups (is_default) where is_default = true;

create table if not exists public.group_seasons (
  group_id uuid not null references public.pickem_groups(id) on delete cascade,
  season_year integer not null,
  status text not null default 'setup' check (status in ('setup','active','complete')),
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (group_id, season_year)
);

create table if not exists public.group_members (
  group_id uuid not null references public.pickem_groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  status text not null default 'active' check (status in ('active','invited','inactive')),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (group_id, profile_id)
);
create index if not exists idx_group_members_profile_active on public.group_members (profile_id, status, group_id);

create table if not exists public.group_game_lines (
  group_id uuid not null references public.pickem_groups(id) on delete cascade,
  game_id text not null references public.games(id) on delete cascade,
  season_year integer not null,
  week integer not null,
  lock_time timestamptz,
  spread_freeze_time timestamptz,
  is_locked boolean not null default false,
  frozen_spread_team text,
  frozen_spread numeric,
  frozen_bookmaker text,
  frozen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (group_id, game_id),
  foreign key (group_id, season_year) references public.group_seasons(group_id, season_year) on delete cascade
);
create index if not exists idx_group_game_lines_group_week on public.group_game_lines (group_id, season_year, week, lock_time);
create index if not exists idx_group_game_lines_game on public.group_game_lines (game_id);

create table if not exists public.group_season_results (
  group_id uuid not null references public.pickem_groups(id) on delete cascade,
  season_year integer not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  final_rank integer,
  wins integer,
  losses integer,
  pushes integer,
  side_bet_net numeric,
  is_champion boolean not null default false,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (group_id, season_year, profile_id),
  foreign key (group_id, season_year) references public.group_seasons(group_id, season_year) on delete cascade
);
create index if not exists idx_group_season_results_profile on public.group_season_results (profile_id);

alter table public.pickem_groups enable row level security;
alter table public.group_seasons enable row level security;
alter table public.group_members enable row level security;
alter table public.group_game_lines enable row level security;
alter table public.group_season_results enable row level security;
revoke all on table public.pickem_groups, public.group_seasons, public.group_members, public.group_game_lines, public.group_season_results from anon, authenticated;
grant select, insert, update, delete on table public.pickem_groups, public.group_seasons, public.group_members, public.group_game_lines, public.group_season_results to service_role;

alter table public.profile_sessions add column if not exists active_group_id uuid references public.pickem_groups(id) on delete set null;
alter table public.picks add column if not exists group_id uuid references public.pickem_groups(id) on delete cascade;
alter table public.side_bets add column if not exists group_id uuid references public.pickem_groups(id) on delete cascade;
alter table public.bank_entries add column if not exists group_id uuid references public.pickem_groups(id) on delete cascade;
alter table public.notifications add column if not exists group_id uuid references public.pickem_groups(id) on delete cascade;

alter table public.picks add column if not exists season_year integer default 2026;
alter table public.side_bets add column if not exists season_year integer default 2026;
alter table public.bank_entries add column if not exists season_year integer default 2026;
alter table public.notifications add column if not exists season_year integer default 2026;

-- Production was backfilled into the seeded shaw-family group / 2026 season before these NOT NULL constraints were enabled.
alter table public.picks alter column group_id set not null;
alter table public.side_bets alter column group_id set not null;
alter table public.bank_entries alter column group_id set not null;
alter table public.notifications alter column group_id set not null;
alter table public.picks alter column season_year set not null;
alter table public.side_bets alter column season_year set not null;
alter table public.bank_entries alter column season_year set not null;
alter table public.notifications alter column season_year set not null;

alter table public.picks drop constraint if exists picks_user_id_game_id_key;
alter table public.picks add constraint picks_group_user_game_key unique (group_id, user_id, game_id);

alter table public.bank_entries drop constraint if exists bank_entries_week_user_id_key;
alter table public.bank_entries drop constraint if exists bank_entries_group_week_user_key;
alter table public.bank_entries add constraint bank_entries_group_season_week_user_key unique (group_id, season_year, week, user_id);

alter table public.notifications drop constraint if exists notifications_user_id_dedupe_key_key;
alter table public.notifications add constraint notifications_group_user_dedupe_key unique (group_id, user_id, dedupe_key);

create index if not exists idx_picks_group_user_week on public.picks (group_id, user_id, week);
create index if not exists idx_picks_group_week_status on public.picks (group_id, week, status);
create index if not exists idx_picks_group_season_week on public.picks (group_id, season_year, week, status);
create index if not exists idx_side_bets_group_week_status on public.side_bets (group_id, week, status);
create index if not exists idx_side_bets_group_season_week on public.side_bets (group_id, season_year, week, status);
create index if not exists idx_bank_entries_group_week on public.bank_entries (group_id, week);
create index if not exists idx_bank_entries_group_season_week on public.bank_entries (group_id, season_year, week);
create index if not exists idx_notifications_group_user_active on public.notifications (group_id, user_id, resolved_at, read_at);
create index if not exists idx_notifications_group_season_user_active on public.notifications (group_id, season_year, user_id, resolved_at, read_at);
