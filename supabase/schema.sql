create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

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
  status text not null default 'draft' check (status in ('draft','locked')),
  locked_spread numeric,
  locked_spread_team text,
  locked_at timestamptz,
  result text not null default 'pending' check (result in ('win','loss','push','pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, game_id)
);

create index if not exists idx_games_week on games(week);
create index if not exists idx_games_lock_time on games(lock_time);
create index if not exists idx_picks_user_week on picks(user_id, week);
create index if not exists idx_picks_game on picks(game_id);

alter table profiles enable row level security;
alter table games enable row level security;
alter table odds_snapshots enable row level security;
alter table picks enable row level security;

create policy "profiles visible to logged in users" on profiles for select to authenticated using (true);
create policy "games visible to logged in users" on games for select to authenticated using (true);
create policy "own picks visible before reveal" on picks for select to authenticated using (
  user_id = auth.uid()
  or exists (
    select 1 from games g where g.id = picks.game_id and g.lock_time <= now()
  )
);
create policy "users insert their own picks" on picks for insert to authenticated with check (user_id = auth.uid());
create policy "users update their own draft picks" on picks for update to authenticated using (user_id = auth.uid() and status = 'draft') with check (user_id = auth.uid());

create or replace view standings as
select
  p.user_id,
  pr.display_name,
  count(*) filter (where p.result = 'win')::int as wins,
  count(*) filter (where p.result = 'loss')::int as losses,
  count(*) filter (where p.result = 'push')::int as pushes,
  case when count(*) filter (where p.result in ('win','loss')) = 0 then 0
       else (count(*) filter (where p.result = 'win'))::numeric / (count(*) filter (where p.result in ('win','loss')))
  end as win_pct
from picks p
join profiles pr on pr.id = p.user_id
where p.status = 'locked'
group by p.user_id, pr.display_name;

-- Optional: create three family users through Supabase Auth UI, then insert their profile rows here.
-- insert into profiles(id, display_name, is_admin) values ('auth-user-uuid', 'Kameron', true);
