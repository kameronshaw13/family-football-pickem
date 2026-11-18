-- Persist each account's Logo Studio selections even when iOS/browser storage is cleared.
-- Published Modern/Vintage collections continue to live in logo_studio_presets.
alter table public.profiles
  add column if not exists logo_studio_choices jsonb not null default '{}'::jsonb;

comment on column public.profiles.logo_studio_choices is
  'Account-backed Logo Studio drafts by canonical team key and modern/vintage style';
