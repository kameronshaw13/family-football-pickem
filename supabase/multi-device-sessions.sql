create extension if not exists pgcrypto;

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

create index if not exists idx_profile_sessions_profile on profile_sessions(profile_id);

alter table profile_sessions enable row level security;
grant all privileges on table profile_sessions to service_role;
