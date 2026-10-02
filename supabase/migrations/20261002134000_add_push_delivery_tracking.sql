alter table public.notifications
  add column if not exists push_sent_at timestamptz,
  add column if not exists push_attempts integer not null default 0,
  add column if not exists push_last_attempt_at timestamptz,
  add column if not exists push_last_error text;

create index if not exists idx_notifications_pending_push
  on public.notifications (created_at)
  where push_sent_at is null;
