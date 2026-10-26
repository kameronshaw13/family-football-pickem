# Football data integrity audit — October 26, 2026

Read-only production audit following the earlier 670-final external score check.
The earlier score and missing-line repairs remain present. No wager terms or
settlements were rewritten during this audit.

The exact-name/date SQL groups found 272 NFL and 655 college matchups, including
future schedules. Administrative missed-pick/dog/settlement placeholders were
excluded. These counts precede normalization of team aliases.

| Check | NFL | College |
|---|---:|---:|
| Exact matchup groups containing duplicate rows | 102 | 36 |
| Different complete final scores across duplicate rows | 0 | 0 |
| Completed matchups missing scores | 0 | 0 |
| Completed matchups missing spreads in every row | 0 | 0 |
| Duplicate groups with different normalized spreads | 19 | 3 |
| Future matchups with no stored spread | 0 | 9 |

The nine missing lines are November 3–6 Central-time college games. Their exact
ESPN event summaries were checked and had no DraftKings pick-center entry.
No lines or historical timestamps were invented.

The 22 differing-line groups include generic Market imports, DraftKings imports,
explicit overrides and earlier/later line values. A score refresh updates a row's
timestamp too; it must not make a generic Market line outrank DraftKings. Shared
display selection now prioritizes explicit overrides, then DraftKings, then other
sources, retaining independent source timestamps and complete score pairs. Saved
pick spreads and side-bet terms remain independent of this display selection.

Two event IDs have alternate spellings: App State/Appalachian State (401869845)
and Louisiana Ragin Cajuns/Ragin' Cajuns (401869932). They share kickoff times.
The App State identity alias is now normalized alongside existing punctuation
normalization. No event ID was found assigned to different kickoff times.

No partial score pairs, negative scores, partial line fields, or unrelated spread
team names were returned by the additional field checks. Tracker parsing no longer
turns null/blank/boolean values into zero. Kickoff yard labels now use the kicking
team from explicit play text or structured field position.

Run `scripts/audit-football-data.sql` for the production checks. Duplicate rows
retain their IDs because picks, bets and snapshots reference them. Do not bulk
delete or overwrite them merely because this report flags differing lines.
