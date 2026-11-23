-- Account-level launch destination. Allows the chosen default to survive sign-out,
-- login and browser/PWA refreshes; access still checked against memberships.
alter table public.profiles
  add column if not exists default_league_slug text;
alter table public.profiles
  drop constraint if exists profiles_default_league_slug_check;
alter table public.profiles
  add constraint profiles_default_league_slug_check
  check (default_league_slug is null or default_league_slug in
    ('shaw-family','other-family','friends','friends-basketball'));
