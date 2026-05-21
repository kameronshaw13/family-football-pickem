# Family Football Pick'em

Private football pick'em app for a small group. Each person picks 5 games from the full CFB/NFL spread board.

## Rules built in

- Pick exactly 5 games per week.
- Users can save picks as drafts during the week.
- Users can manually lock a pick early to freeze the current spread.
- Locked picks stay hidden from everyone else until that game closes.
- Tuesday, Wednesday, Thursday, and Friday games close 24 hours before kickoff.
- Saturday, Sunday, and Monday games close Friday at 5:00 PM CT.
- Monday Night Football also closes Friday at 5:00 PM CT.
- Once a game closes, it cannot be picked or changed.
- Standings are W-L-P.
- Pushes do not count against win percentage.

## Odds refresh schedule

`vercel.json` schedules Odds API pulls Monday-Friday at:

- 2 AM CT
- 6 AM CT
- 10 AM CT
- 2 PM CT
- 6 PM CT
- 10 PM CT

Each pull requests only `markets=spreads` and `regions=us` for NFL and CFB.

Estimated usage:

- 2 credits per refresh round
- 6 rounds per day = 12 credits/day
- 5 days/week = 60 credits/week
- 5-week month = about 300 credits/month

That is under a 500-credit/month Odds API plan.

## Local setup

```bash
cd ~/Downloads
unzip family-football-pickem.zip -d family-football-pickem
cd family-football-pickem
npm install
cp .env.example .env.local
npm run dev
```

The app opens with demo data until Supabase keys are added.

## Supabase setup

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `supabase/schema.sql`.
4. Create users in Supabase Auth for you, your dad, and your brother.
5. Add corresponding rows to `profiles` using each Auth user UUID.
6. Add these Vercel environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ODDS_API_KEY=
CRON_SECRET=
APP_TIMEZONE=America/Chicago
```

## Vercel deploy

```bash
cd ~/Downloads/family-football-pickem
npm run build

git init
git add .
git commit -m "initial family football pickem app"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

Then import the GitHub repo into Vercel and add the environment variables.

## Important files

- `lib/lockRules.ts` contains all lock deadline logic.
- `app/api/cron/odds/route.ts` pulls spreads from The Odds API.
- `app/api/cron/lock/route.ts` auto-locks closed games and draft picks.
- `app/api/picks/route.ts` handles draft picks and early lock picks.
- `app/api/results/route.ts` grades picks from final scores.
- `supabase/schema.sql` creates the database tables, policies, and standings view.
