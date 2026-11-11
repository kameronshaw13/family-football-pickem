-- Per-profile auto-decline applies to every league and every side-bet creation path.
-- Defaults off for all users; individual opt-ins are data, not part of the schema.
alter table public.profiles
  add column if not exists auto_decline_side_bets boolean not null default false;

-- A server-side rule is safer than depending on clients or particular API routes.
create or replace function public.side_bet_target_auto_decline_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.response = 'pending' and exists (
    select 1 from public.profiles p
    where p.id = new.recipient_id and p.auto_decline_side_bets
  ) then
    new.response := 'declined';
    new.responded_at := now();
  end if;
  return new;
end;
$$;

create trigger side_bet_target_auto_decline_before_insert
before insert on public.side_bet_targets
for each row
execute function public.side_bet_target_auto_decline_before_insert();

-- Keep the sender's state correct even when an offer has multiple recipients.
-- A decline closes the overall offer only if nobody is still pending.
create or replace function public.side_bet_target_auto_decline_after_response()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  recipient_name text;
begin
  if new.response <> 'declined' then
    return new;
  end if;

  select p.display_name into recipient_name
  from public.profiles p
  where p.id = new.recipient_id and p.auto_decline_side_bets;

  if recipient_name is null then
    return new;
  end if;

  update public.side_bets sb
  set status = 'declined', updated_at = now()
  where sb.id = new.side_bet_id
    and sb.status = 'open'
    and sb.accepted_by is null
    and not exists (
      select 1 from public.side_bet_targets t
      where t.side_bet_id = new.side_bet_id
        and t.response in ('pending', 'accepted')
    );

  insert into public.notifications (
    group_id, season_year, user_id, type, destination,
    entity_id, dedupe_key, title, body, url, action_required
  )
  select
    sb.group_id, sb.season_year, sb.creator_id, 'side_bet_response',
    'side_bets_sent', sb.id::text,
    'side-bet-declined:' || sb.id::text || ':' || new.recipient_id::text,
    recipient_name || ' declined your side bet',
    'Your side bet offer was declined.',
    case pg.slug
      when 'friends-basketball' then '/friends-basketball?notification=side_bets_sent'
      when 'friends' then '/friends?notification=side_bets_sent'
      when 'other-family' then '/caleb-family?notification=side_bets_sent'
      when 'shaw-family' then '/?notification=side_bets_sent'
      else '/?group=' || sb.group_id::text || '&notification=side_bets_sent'
    end,
    false
  from public.side_bets sb
  join public.pickem_groups pg on pg.id = sb.group_id
  where sb.id = new.side_bet_id
    and sb.creator_id <> new.recipient_id
  on conflict (group_id, user_id, dedupe_key) do nothing;

  return new;
end;
$$;

create trigger side_bet_target_auto_decline_after_insert
after insert on public.side_bet_targets
for each row
when (new.response = 'declined')
execute function public.side_bet_target_auto_decline_after_response();

create trigger side_bet_target_auto_decline_after_update
after update of response on public.side_bet_targets
for each row
when (new.response = 'declined')
execute function public.side_bet_target_auto_decline_after_response();

-- Existing app routes create offer notifications after target insertion.
-- Suppress only offers that already auto-declined, leaving all other alerts alone.
create or replace function public.skip_auto_declined_side_bet_offer_notification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.type = 'side_bet_offer' and exists (
    select 1 from public.side_bet_targets t
    join public.profiles p on p.id = t.recipient_id
    where t.side_bet_id::text = new.entity_id
      and t.recipient_id = new.user_id
      and t.response = 'declined'
      and p.auto_decline_side_bets
  ) then
    return null;
  end if;
  return new;
end;
$$;

create trigger skip_auto_declined_side_bet_offer_notification
before insert on public.notifications
for each row
execute function public.skip_auto_declined_side_bet_offer_notification();
