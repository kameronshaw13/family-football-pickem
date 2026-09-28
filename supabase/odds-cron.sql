-- Token-free market refresh: ESPN supplies schedules, Action Network supplies spreads.
-- Provision odds_cron_token in Vault first. Keep the matching SHA-256 digest in
-- the deployment environment. The endpoint itself enforces the CT refresh window
-- and the existing spread-freeze rules.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'odds_cron_token') then
    raise exception 'Create the odds_cron_token Vault secret before scheduling market updates';
  end if;
end $$;

select cron.unschedule('refresh-pickem-odds-hourly')
where exists (select 1 from cron.job where jobname = 'refresh-pickem-odds-hourly');

select cron.unschedule('refresh-pickem-markets-5m')
where exists (select 1 from cron.job where jobname = 'refresh-pickem-markets-5m');

select cron.schedule(
  'refresh-pickem-markets-5m',
  '*/5 * * * *',
  $job$
    select net.http_get(
      url := 'https://family-football-pickem.vercel.app/api/cron/odds',
      headers := jsonb_build_object(
        'x-odds-cron-token',
        (select decrypted_secret from vault.decrypted_secrets where name = 'odds_cron_token')
      ),
      timeout_milliseconds := 60000
    );
  $job$
);
