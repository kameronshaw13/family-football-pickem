# External scheduler setup

Vercel Hobby blocks cron jobs that run more than once per day. Keep the app on Vercel, but use an external scheduler to call the app's secure cron endpoint.

## Endpoint to call

```txt
https://YOUR-VERCEL-APP.vercel.app/api/cron/tick?secret=YOUR_CRON_SECRET
```

The `CRON_SECRET` value must match the environment variable you set in Vercel.

## Schedule

Keep the six regular daily jobs:

- 2:00 AM CT
- 6:00 AM CT
- 10:00 AM CT
- 2:00 PM CT
- 6:00 PM CT
- 10:00 PM CT

Add two Saturday-morning jobs:

- Saturday 7:50 AM CT
- Saturday 8:50 AM CT

Each run refreshes both CFB and NFL, locks closed picks, checks official ESPN final scores, grades picks and side bets, and settles the weekly bank when a group is ready.

The Saturday-only calls create two extra weekend line checks around 8:00 and 9:00 AM. The 8:50 AM call is the final scheduled refresh for Saturday-Monday games before those lines freeze at 9:00 AM CT. Saturday-Monday picks then lock at 10:00 AM CT.

Tuesday-Friday games stay on the per-game schedule: their lines freeze 1 hour before kickoff and their picks lock at kickoff. This keeps Friday games out of the weekend freeze window even when they kick after Friday evening.

Because many schedulers use UTC, during daylight saving time Central Time is UTC-5:

- 2:00 AM CT = 07:00 UTC
- 6:00 AM CT = 11:00 UTC
- Saturday 7:50 AM CT = 12:50 UTC
- Saturday 8:50 AM CT = 13:50 UTC
- 10:00 AM CT = 15:00 UTC
- 2:00 PM CT = 19:00 UTC
- 6:00 PM CT = 23:00 UTC
- 10:00 PM CT = 03:00 UTC next day

If the scheduler supports America/Chicago time zones, use that instead so daylight-saving changes are handled automatically.

## What the endpoint does

`/api/cron/tick` calls:

1. `/api/cron/odds` to refresh current spreads.
2. `/api/cron/lock` to close any games whose deadline has passed and lock draft picks.
3. `/api/cron/results` to import ESPN finals, grade picks and side bets, and automatically settle completed weeks.

There is no manual refresh or weekly settlement control in the app. The external cron schedule handles both. Vercel also runs `/api/cron/results` once nightly as a fallback.
