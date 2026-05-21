create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table profiles add column if not exists username text;
create unique index if not exists profiles_username_unique on profiles(username);

create table if not exists games (
  id text primary key,
  week integer not null,
  league text not null check (league in ('NFL','CFB')),
  commence_time timestamptz not null,
  home_team text not null,
  away_team text not null,
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

create index if not exists idx_games_week on games(week);
create index if not exists idx_games_lock_time on games(lock_time);
create index if not exists idx_picks_user_week on picks(user_id, week);
create index if not exists idx_picks_game on picks(game_id);
create index if not exists idx_picks_type on picks(pick_type);

alter table profiles enable row level security;
alter table games enable row level security;
alter table odds_snapshots enable row level security;
alter table picks enable row level security;

drop policy if exists "profiles visible to logged in users" on profiles;
drop policy if exists "games visible to logged in users" on games;
drop policy if exists "own picks visible before reveal" on picks;
drop policy if exists "users insert their own picks" on picks;
drop policy if exists "users update their own draft picks" on picks;

create policy "profiles visible to logged in users" on profiles for select to authenticated using (true);
create policy "games visible to logged in users" on games for select to authenticated using (true);
create policy "own picks visible before reveal" on picks for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from games g where g.id = picks.game_id and g.lock_time <= now())
);
create policy "users insert their own picks" on picks for insert to authenticated with check (user_id = auth.uid());
create policy "users update their own draft picks" on picks for update to authenticated using (user_id = auth.uid() and status = 'draft') with check (user_id = auth.uid());

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
grant all privileges on table games to service_role;
grant all privileges on table odds_snapshots to service_role;
grant all privileges on table picks to service_role;
grant select on table standings to anon, authenticated, service_role;
grant select on table games to anon, authenticated;
grant select on table odds_snapshots to anon, authenticated;
grant select on table profiles to authenticated;
grant select, insert, update, delete on table picks to authenticated;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
