create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('side_bet_offer','side_bet_response','pick_final','league_pick_final','side_bet_final','big_play')),
  destination text not null check (destination in ('side_bets_received','side_bets_sent','my_card','league_cards','side_bet_ledger')),
  entity_id text not null,
  dedupe_key text not null,
  title text not null,
  body text not null,
  url text not null,
  action_required boolean not null default false,
  read_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_active on notifications(user_id, resolved_at, read_at);
create index if not exists idx_notifications_entity on notifications(type, entity_id);
create index if not exists idx_push_subscriptions_user on push_subscriptions(user_id);

alter table notifications enable row level security;
alter table push_subscriptions enable row level security;

revoke all privileges on table notifications from anon, authenticated;
revoke all privileges on table push_subscriptions from anon, authenticated;
grant all privileges on table notifications to service_role;
grant all privileges on table push_subscriptions to service_role;
