# Family Football Pick'em

Ready-mode private family football pick'em app.

## Rules built in

- Users: `kameron`, `mike`, `quentin`.
- Each user claims their username once and creates their own password.
- Week 1: three CFB spread picks plus one dog.
- Week 2: five CFB spread picks plus one dog.
- Mixed regular season: five spread picks with at least one CFB and one NFL pick, plus one dog.
- After CFB ends: two NFL spread picks plus one dog through the end of the NFL regular season.
- Bowl games, the CFP, and NFL playoff games are excluded.
- Los Angeles Chargers games are excluded entirely.
- One underdog pick per week.
- Underdog bonus wins:
  - +7 to +9.5: 1 extra win
  - +10 to +19.5: 2 extra wins
  - +20 or more: 3 extra wins
- Underdog picks must win outright.
- You cannot double dip the same game as both a regular spread pick and an underdog pick.
- Board selections are staged locally until the user saves the card.
- Saved draft picks can be changed until their game closes.
- Tuesday-Friday games close 24 hours before kickoff.
- Saturday/Sunday/Monday games close Friday at 5 PM CT.
- Picks stay hidden from the group until the game closes.
- Pushes do not count against win percentage.
- Standings use win percentage first, then total wins.
- Weekly bank payouts are $20 from last and $10 from second to first.
- Tied last-place players pay $15 each. Tied winners split the $20 last-place payment.
- A 5-0 or better winning record with no losses doubles weekly payments only on five-pick weeks.
- Side bets use a frozen point spread and a player-chosen dollar amount.
- Side bets can be sent to one player or both; the first player to accept owns the offered side.
- Side bets must be accepted before kickoff and settle into bank balances with the game result.

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
