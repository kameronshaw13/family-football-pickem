-- Applied to production on 2026-08-21.
-- Each installed Pick'em app owns a group-scoped push subscription.

alter table public.push_subscriptions
  add column if not exists group_id uuid references public.pickem_groups(id) on delete cascade;

update public.push_subscriptions
set group_id = (
  select id from public.pickem_groups where is_default = true limit 1
)
where group_id is null;

alter table public.push_subscriptions
  alter column group_id set not null;

create index if not exists idx_push_subscriptions_group_user
  on public.push_subscriptions(group_id, user_id);
