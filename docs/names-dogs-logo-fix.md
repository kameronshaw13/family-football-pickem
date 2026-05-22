Code-only patch.

Changes:
- College display names now strip mascots, e.g. Ohio State Buckeyes -> Ohio State.
- NFL display names now show nicknames only, e.g. Los Angeles Chargers -> Chargers.
- DOGS filter only shows underdog teams, not favored sides.
- DOGS line format is +10.5 = +2W.
- Spread text moved closer to names.
- Team logo opacity fixed, white circle removed, logo sizes normalized.
- Header/theme color extended to the top safe-area.
- College logo matching improved for San Jose State, Hawaii, Memphis/Auburn tiger conflicts and accented names.

No Supabase schema change needed. Run cron tick after deploy to overwrite any already-saved bad logo URLs.
