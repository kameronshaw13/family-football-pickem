# Basketball analytics and 2026 launch

Friends Basketball starts November 1, 2026. The Sunday Villanova–Notre Dame
opener belongs to an eight-day November 1–8 opening card. Weeks then run
Monday–Sunday, with Week 2 starting November 9. Five regular spread picks plus
one dog apply throughout; March Madness payout dates are unchanged.

Torvik seasons use the ending year: the 2026–27 season is `2027`.
The authenticated `/api/cbb-analytics` endpoint reads these public downloads:

- `https://barttorvik.com/{year}_team_results.csv`
- `https://barttorvik.com/{year}_fffinal.csv`
- `https://barttorvik.com/getadvstats.php?year={year}&csv=1`

These public data files require no API key. This does not assert an open-source
license for Torvik's ratings/formulas. No interactive-page browser checks are
bypassed. Requests are shared/cached for an hour, with bounded 12-second fetches.
Failures can retain an explicitly dated, last-good process snapshot for 48 hours.
NBA continues to use its existing data sources; Torvik is college-only.

The new-season ratings contain preseason projections before games are played.
Four Factors and observed résumé stats remain unavailable until published; empty
values do not become zero. Player exports can contain prior-season inputs on
current rosters. Do not display them as new-season results: require team games
played, matching ending year, the documented 67-column schema, and player games
no greater than the team's games played.

CSV parsing preserves repeated rank columns and quoted names. Four Factors rank
columns belong to the immediately preceding metric. The source's `DR%` is the
opponent offensive rebound rate, not defensive rebound percentage. Percentage
scales differ in player exports: fractional shooting fields are converted to
percent while usage/eFG/TS fields are already percentage points.

Validation on October 26: 365 Torvik ratings parsed; all 362 teams in ESPN's
current team directory mapped using normalized school names and explicit aliases.
Ambiguous or unrecognized names return unavailable, rather than a one-team match.
The complete 2025–26 Four Factors file was also parsed to verify its schema;
last season's values are never substituted into the 2026–27 comparison.

The launch correction migration saves the old rules, 32 premature automatic
missed picks and eight zero-dollar settlement entries in a service-only backup
before reversing them. It aborts if real picks, side bets or nonzero banking
activity are present. No real player wager terms are rewritten.

The supplied basketball logo is used unchanged for the header, login, PWA icon,
favicon/Apple icon and push notifications. It is separate from football branding.
