create table if not exists public.matchup_stat_snapshots (
  league text not null check (league in ('CFB','NFL')),
  season integer not null,
  through_week integer not null check (through_week >= 0),
  payload jsonb not null,
  source text not null,
  source_updated_at timestamptz,
  fetched_at timestamptz not null default now(),
  primary key (league, season, through_week)
);

alter table public.matchup_stat_snapshots enable row level security;
revoke all on table public.matchup_stat_snapshots from anon, authenticated;

create index if not exists matchup_stat_snapshots_latest_idx
  on public.matchup_stat_snapshots (league, season, through_week desc);
