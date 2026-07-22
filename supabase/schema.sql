create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  username text unique,
  display_name text not null,
  is_admin boolean not null default false,
  password_hash text,
  session_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles drop constraint if exists profiles_id_fkey;
alter table profiles alter column id set default gen_random_uuid();
alter table profiles add column if not exists username text;
alter table profiles add column if not exists password_hash text;
alter table profiles add column if not exists session_token text;
alter table profiles add column if not exists updated_at timestamptz not null default now();
create unique index if not exists profiles_username_unique on profiles(username);
create unique index if not exists profiles_session_token_unique on profiles(session_token) where session_token is not null;

create table if not exists profile_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);

insert into profile_sessions (profile_id, token_hash)
select id, encode(digest(session_token, 'sha256'), 'hex')
from profiles
where session_token is not null
on conflict (token_hash) do nothing;

create table if not exists games (
  id text primary key,
  week integer not null,
  league text not null check (league in ('NFL','CFB')),
  commence_time timestamptz not null,
  home_team text not null,
  away_team text not null,
  home_logo_url text,
  away_logo_url text,
  current_spread_team text,
  current_spread numeric,
  current_bookmaker text,
  lock_time timestamptz not null,
  is_locked boolean not null default false,
  final_home_score integer,
  final_away_score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table games add column if not exists home_logo_url text;
alter table games add column if not exists away_logo_url text;

-- Convert early college games that were previously bucketed as Week 1 into Week 0.
update games
set week = 0, updated_at = now()
where league = 'CFB'
  and week = 1
  and extract(month from commence_time at time zone 'America/Chicago') = 8
  and extract(day from commence_time at time zone 'America/Chicago') < 25;

create table if not exists odds_snapshots (
  id uuid primary key default gen_random_uuid(),
  game_id text references games(id) on delete cascade,
  league text not null check (league in ('NFL','CFB')),
  spread_team text,
  spread numeric,
  bookmaker text,
  raw jsonb,
  created_at timestamptz not null default now()
);

create table if not exists picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  game_id text not null references games(id) on delete cascade,
  week integer not null,
  selected_team text not null,
  pick_type text not null default 'regular' check (pick_type in ('regular','underdog')),
  status text not null default 'draft' check (status in ('draft','locked')),
  locked_spread numeric,
  locked_spread_team text,
  locked_at timestamptz,
  underdog_win_value integer,
  result text not null default 'pending' check (result in ('win','loss','push','pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, game_id)
);

alter table picks add column if not exists pick_type text not null default 'regular';
alter table picks add column if not exists underdog_win_value integer;

do $$ begin
  alter table picks add constraint picks_pick_type_check check (pick_type in ('regular','underdog'));
exception when duplicate_object then null;
end $$;

create table if not exists bank_settings (
  id integer primary key default 1,
  winner_amount numeric not null default 20,
  loser_amount numeric not null default 10,
  updated_at timestamptz not null default now(),
  constraint bank_settings_singleton check (id = 1)
);

insert into bank_settings (id, winner_amount, loser_amount)
values (1, 20, 10)
on conflict (id) do nothing;

create table if not exists bank_entries (
  id uuid primary key default gen_random_uuid(),
  week integer not null,
  user_id uuid not null references profiles(id) on delete cascade,
  amount numeric not null,
  note text,
  created_at timestamptz not null default now(),
  unique(week, user_id)
);

create table if not exists side_bets (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null,
  game_id text not null,
  week integer not null,
  creator_team text not null,
  offered_team text not null,
  creator_spread numeric not null,
  offered_spread numeric not null,
  amount numeric(10,2) not null check (amount > 0 and amount <= 10000),
  status text not null default 'open' check (status in ('open','accepted','declined','cancelled','expired','settled')),
  accepted_by uuid,
  accepted_at timestamptz,
  winner_id uuid,
  result text not null default 'pending' check (result in ('pending','creator_win','acceptor_win','push')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint side_bets_creator_id_fkey foreign key (creator_id) references profiles(id) on delete cascade,
  constraint side_bets_game_id_fkey foreign key (game_id) references games(id) on delete cascade,
  constraint side_bets_accepted_by_fkey foreign key (accepted_by) references profiles(id) on delete set null,
  constraint side_bets_winner_id_fkey foreign key (winner_id) references profiles(id) on delete set null,
  constraint side_bets_distinct_teams check (creator_team <> offered_team)
);

create table if not exists side_bet_targets (
  side_bet_id uuid not null,
  recipient_id uuid not null,
  response text not null default 'pending' check (response in ('pending','accepted','declined','closed')),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (side_bet_id, recipient_id),
  constraint side_bet_targets_side_bet_id_fkey foreign key (side_bet_id) references side_bets(id) on delete cascade,
  constraint side_bet_targets_recipient_id_fkey foreign key (recipient_id) references profiles(id) on delete cascade
);

create index if not exists idx_games_week on games(week);
create index if not exists idx_games_lock_time on games(lock_time);
create index if not exists idx_picks_user_week on picks(user_id, week);
create index if not exists idx_picks_game on picks(game_id);
create index if not exists idx_picks_type on picks(pick_type);
create index if not exists idx_bank_entries_week on bank_entries(week);
create index if not exists idx_bank_entries_user on bank_entries(user_id);
create index if not exists idx_side_bets_creator on side_bets(creator_id);
create index if not exists idx_side_bets_game on side_bets(game_id);
create index if not exists idx_side_bets_status on side_bets(status);
create index if not exists idx_side_bets_accepted_by on side_bets(accepted_by);
create index if not exists idx_side_bet_targets_recipient on side_bet_targets(recipient_id);
create index if not exists idx_profile_sessions_profile on profile_sessions(profile_id);

alter table profiles enable row level security;
alter table profile_sessions enable row level security;
alter table games enable row level security;
alter table odds_snapshots enable row level security;
alter table picks enable row level security;
alter table bank_settings enable row level security;
alter table bank_entries enable row level security;
alter table side_bets enable row level security;
alter table side_bet_targets enable row level security;

drop policy if exists "profiles visible to logged in users" on profiles;
drop policy if exists "games visible to logged in users" on games;
drop policy if exists "own picks visible before reveal" on picks;
drop policy if exists "users insert their own picks" on picks;
drop policy if exists "users update their own draft picks" on picks;
drop policy if exists "bank settings visible to logged in users" on bank_settings;
drop policy if exists "bank entries visible to logged in users" on bank_entries;
drop policy if exists "side bets visible to logged in users" on side_bets;
drop policy if exists "side bet targets visible to logged in users" on side_bet_targets;

create policy "profiles visible to logged in users" on profiles for select to authenticated using (true);
create policy "games visible to logged in users" on games for select to authenticated using (true);
create policy "own picks visible before reveal" on picks for select to authenticated using (
  true
);
create policy "users insert their own picks" on picks for insert to authenticated with check (true);
create policy "users update their own draft picks" on picks for update to authenticated using (true) with check (true);
create policy "bank settings visible to logged in users" on bank_settings for select to authenticated using (true);
create policy "bank entries visible to logged in users" on bank_entries for select to authenticated using (true);
create policy "side bets visible to logged in users" on side_bets for select to authenticated using (true);
create policy "side bet targets visible to logged in users" on side_bet_targets for select to authenticated using (true);

create or replace view standings as
select
  p.user_id,
  pr.display_name,
  coalesce(sum(case when p.result = 'win' and p.pick_type = 'underdog' then coalesce(p.underdog_win_value, 1)
                    when p.result = 'win' then 1 else 0 end),0)::int as wins,
  count(*) filter (where p.result = 'loss')::int as losses,
  count(*) filter (where p.result = 'push')::int as pushes,
  case when (coalesce(sum(case when p.result = 'win' and p.pick_type = 'underdog' then coalesce(p.underdog_win_value, 1)
                               when p.result = 'win' then 1 else 0 end),0) + count(*) filter (where p.result = 'loss')) = 0 then 0
       else coalesce(sum(case when p.result = 'win' and p.pick_type = 'underdog' then coalesce(p.underdog_win_value, 1)
                              when p.result = 'win' then 1 else 0 end),0)::numeric
            / (coalesce(sum(case when p.result = 'win' and p.pick_type = 'underdog' then coalesce(p.underdog_win_value, 1)
                                 when p.result = 'win' then 1 else 0 end),0) + count(*) filter (where p.result = 'loss'))
  end as win_pct
from picks p
join profiles pr on pr.id = p.user_id
where p.status = 'locked'
group by p.user_id, pr.display_name;

grant usage on schema public to anon, authenticated, service_role;
grant all privileges on table profiles to service_role;
grant all privileges on table profile_sessions to service_role;
grant all privileges on table games to service_role;
grant all privileges on table odds_snapshots to service_role;
grant all privileges on table picks to service_role;
grant all privileges on table bank_settings to service_role;
grant all privileges on table bank_entries to service_role;
grant all privileges on table side_bets to service_role;
grant all privileges on table side_bet_targets to service_role;
grant select on table standings to anon, authenticated, service_role;
grant select on table games to anon, authenticated;
grant select on table odds_snapshots to anon, authenticated;
grant select on table profiles to authenticated;
grant select on table bank_settings to authenticated;
grant select on table bank_entries to authenticated;
grant select on table side_bets to authenticated;
grant select on table side_bet_targets to authenticated;
grant select, insert, update, delete on table picks to authenticated;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
