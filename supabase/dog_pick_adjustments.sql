-- Allow persistent My Card alerts when an unlocked dog crosses a bonus threshold
-- or falls below the +7 eligibility floor. Applied to production on 2026-08-19.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type in (
    'side_bet_offer',
    'side_bet_response',
    'pick_final',
    'league_pick_final',
    'side_bet_final',
    'big_play',
    'dog_pick_adjustment'
  )
);
