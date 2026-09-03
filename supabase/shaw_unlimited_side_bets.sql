-- Shaw Family Pick'em: remove the weekly side-bet count cap while preserving
-- the existing enabled state and per-bet amount cap.
update public.group_seasons as season
set rules = jsonb_set(
  coalesce(season.rules, '{}'::jsonb),
  '{sideBets,maxPerWeek}',
  'null'::jsonb,
  true
)
from public.pickem_groups as pickem_group
where season.group_id = pickem_group.id
  and season.season_year = pickem_group.current_season_year
  and pickem_group.slug = 'shaw-family';
