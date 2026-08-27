# External scheduler setup

Vercel Hobby blocks cron jobs that run more than once per day. Keep the app on Vercel, but use an external scheduler to call the app's secure cron endpoint.

## Endpoint to call

```txt
https://YOUR-VERCEL-APP.vercel.app/api/cron/tick?secret=YOUR_CRON_SECRET
```

The `CRON_SECRET` value must match the environment variable you set in Vercel.

## Schedule

Keep the regular scheduler jobs that cover Tuesday-Friday games, including a Friday 8:50 PM CT call so a Friday 10:00 PM CT kickoff can receive its final update before the 9:00 PM line freeze.

Add these Saturday-morning jobs:

- Saturday 8:50 AM CT
- Saturday 9:50 AM CT

Each run refreshes both CFB and NFL, locks closed picks, checks official ESPN final scores, grades picks and side bets, and settles the weekly bank when a group is ready.

The Saturday-only calls create two extra weekend line checks around 9:00 and 10:00 AM. The 9:50 AM call is the final scheduled refresh for Saturday-Monday games before those lines freeze at 10:00 AM CT. Saturday-Monday picks then lock at 11:00 AM CT.

Tuesday-Friday games stay on the per-game schedule: their lines freeze 1 hour before kickoff and their picks lock at kickoff. This keeps Friday games out of the weekend freeze window even when they kick late Friday night.

Because many schedulers use UTC, during daylight saving time Central Time is UTC-5:

- Friday 8:50 PM CT = 01:50 UTC Saturday
- Saturday 8:50 AM CT = 13:50 UTC
- Saturday 9:50 AM CT = 14:50 UTC

If the scheduler supports America/Chicago time zones, use that instead so daylight-saving changes are handled automatically.

## What the endpoint does

`/api/cron/tick` calls:

1. `/api/cron/odds` to refresh current spreads.
2. `/api/cron/lock` to close any games whose deadline has passed and lock draft picks.
3. `/api/cron/results` to import ESPN finals, grade picks and side bets, and automatically settle completed weeks.

There is no manual refresh or weekly settlement control in the app. The external cron schedule handles both. Vercel also runs `/api/cron/results` once nightly as a fallback.
