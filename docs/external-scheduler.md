# Scheduled jobs

Odds updates are scheduled by **Supabase Cron**, not cron-job.org or Vercel Cron.
All three apps consume the same games and odds pipeline. Group rules are applied separately when presenting games and validating picks.

## Current schedule

The audited production job is `refresh-pickem-markets-5m`, but its actual schedule is `50 * * * *` (UTC): once per hour. The name does not reflect its cadence. After the scheduler SQL in this branch is applied, the job will be `refresh-pickem-markets-30m` at `20,50 * * * *` (UTC).
It calls `/api/cron/odds` with `x-odds-cron-token` loaded from the Vault secret `odds_cron_token`.
The endpoint enforces America/Chicago time, including daylight saving:

- Tuesday: 7:50 AM CT before week open.
- Tuesday–Friday: every 30 minutes, 8:20 AM–8:50 PM CT.
- Sunday–Monday: 8:50 AM CT schedule and future-line refresh.
- Saturday: 8:50 PM and 9:50 PM CT.
- Outside these windows: HTTP 200 with `skipped: true`, without spending Odds API credits.

Vercel still runs the results fallback daily (`30 6 * * *` UTC) and the Saturday locking fallback (`5 17 * * 6` UTC), as recorded in `vercel.json`. Do not add a second odds scheduler or schedule the legacy `/api/cron/tick` endpoint.

## Recreate or rotate the odds job

1. Enable the Cron (`pg_cron`) and `pg_net` integrations in Supabase.
2. Create a strong random token in Supabase Vault named `odds_cron_token`. Do not put its value in source control, URLs, logs, or this document.
3. Configure the token's SHA-256 hex digest as the Vercel server variable `ODDS_CRON_TOKEN_SHA256`, then redeploy. The existing production digest remains the fallback until this variable is configured.
4. Deploy the matching app code first, then run `supabase/odds-cron.sql` after reviewing its deployment URL. The script removes the old hourly job and creates the new 30-minute job.
5. Verify a scheduled run and its actual HTTP response. A successful pg_cron run only means the asynchronous request was queued.

Do not manually invoke the odds endpoint for testing unless an extra paid odds refresh is intended.

## Health checks

Run in the Supabase SQL editor:

```sql
select jobid, jobname, schedule, active
from cron.job where jobname like 'refresh-pickem-%';

select start_time, end_time, status, return_message
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'refresh-pickem-markets-30m')
order by start_time desc limit 24;

select id, created, status_code, timed_out, error_msg, left(content, 800) as response
from net._http_response
order by created desc limit 24;
```

Check for HTTP 200 and `ok: true` (or the documented skipped response). Investigate non-2xx responses, timeouts, missing responses, or no successful refresh during an allowed window. Responses from other pg_net jobs can appear in the same table. These checks are operational diagnostics, not an automatic alerting service.

pg_net responses have limited retention. Check failures promptly. Review and prune old `cron.job_run_details` records as part of database maintenance; do not delete recent incident evidence.

## Local verification

Run `npm ci`, `npm run lint`, `npm test`, and `npm run build`.
The matchup preview uses bounded caches and request timeouts; no scheduler is required for its data.
