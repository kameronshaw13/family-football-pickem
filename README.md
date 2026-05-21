# Family Football Pick'em

Ready-mode private family football pick'em app.

## Rules built in

- Users: `kameron`, `dad`, `mike`, `quentin`.
- Each user claims their username once and creates their own password.
- Week 0: 3 college regular picks only.
- Week 1: 5 college regular picks only.
- After the NFL starts: 3 college + 2 NFL regular picks.
- One underdog pick per week.
- Underdog bonus wins:
  - +7 to +9.5: 1 extra win
  - +10 to +19.5: 2 extra wins
  - +20 or more: 3 extra wins
- Underdog picks must win outright.
- You cannot double dip the same game as both a regular spread pick and an underdog pick.
- Draft picks can be changed until the game closes.
- Users can lock early to freeze their own line.
- Tuesday-Friday games close 24 hours before kickoff.
- Saturday/Sunday/Monday games close Friday at 5 PM CT.
- Picks stay hidden from the group until the game closes.
- Pushes do not count against win percentage.

## Setup after applying this patch

1. Run the updated Supabase schema in `supabase/schema.sql`.
2. Redeploy Vercel.
3. Go to `/login`.
4. Each user clicks **First time**, selects their username, and creates a password.
5. After claiming, they use **Sign in** with username + password.

## External scheduler

Use cron-job.org to call:

```txt
https://YOUR-VERCEL-APP.vercel.app/api/cron/tick?secret=YOUR_CRON_SECRET
```

Schedule it Monday-Friday at 2 AM, 6 AM, 10 AM, 2 PM, 6 PM, and 10 PM CT.
