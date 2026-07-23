# External scheduler setup

Vercel Hobby blocks cron jobs that run more than once per day. Keep the app on Vercel, but use an external scheduler to call the app's secure cron endpoint.

## Endpoint to call

```txt
https://YOUR-VERCEL-APP.vercel.app/api/cron/tick?secret=YOUR_CRON_SECRET
```

The `CRON_SECRET` value must match the environment variable you set in Vercel.

## Schedule

Create six jobs, Monday-Friday only:

- 2:00 AM CT
- 6:00 AM CT
- 10:00 AM CT
- 2:00 PM CT
- 6:00 PM CT
- 10:00 PM CT

This is the automatic odds schedule. Each run refreshes both CFB and NFL. For Saturday-Monday games, the Friday 6:00 PM run is the final spread update and picks close at 7:00 PM. For Tuesday-Friday games, the app stops accepting spread changes 25 hours before kickoff and closes picks 24 hours before kickoff.

Because many schedulers use UTC, during daylight saving time Central Time is UTC-5:

- 2:00 AM CT = 07:00 UTC
- 6:00 AM CT = 11:00 UTC
- 10:00 AM CT = 15:00 UTC
- 2:00 PM CT = 19:00 UTC
- 6:00 PM CT = 23:00 UTC
- 10:00 PM CT = 03:00 UTC next day

If the scheduler supports America/Chicago time zones, use that instead.

## What the endpoint does

`/api/cron/tick` calls:

1. `/api/cron/odds` to refresh current spreads.
2. `/api/cron/lock` to close any games whose deadline has passed and lock draft picks.

There is no manual refresh control in the app. The external cron schedule is the only way spreads are refreshed.
