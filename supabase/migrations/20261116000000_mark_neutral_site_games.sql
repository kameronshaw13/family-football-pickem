alter table public.games
  add column if not exists neutral_site boolean not null default false;
