-- Idempotent recovery script. Provision odds_cron_token in Vault first.
-- Keep the matching SHA-256 digest in the deployment environment.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'odds_cron_token') then
    raise exception 'Create the odds_cron_token Vault secret before scheduling odds updates';
  end if;
end $$;

select cron.schedule(
  'refresh-pickem-odds-hourly',
  '50 * * * *',
  $job$
    select net.http_get(
      url := 'https://family-football-pickem.vercel.app/api/cron/odds',
      headers := jsonb_build_object(
        'x-odds-cron-token',
        (select decrypted_secret from vault.decrypted_secrets where name = 'odds_cron_token')
      ),
      timeout_milliseconds := 30000
    );
  $job$
);
