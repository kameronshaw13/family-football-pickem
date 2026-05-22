Code-only patch. No Supabase schema update needed.

Changes:
- Removes the large Spread/Dog selector from the board.
- Uses the DOGS filter to switch the board into underdog selection mode.
- Week 1 now uses the first-week rules: 3 CFB picks + 1 dog.
- Week 2 uses 5 CFB picks + 1 dog.
- Week 3+ uses 3 CFB + 2 NFL + 1 dog.
- Updates the Rules tab text to match those labels.
- Removes opacity fade on closed cards so logos do not look faded.
- Removes the white logo circle/background and normalizes logo sizing.
- Adds safer ESPN college logo matching so common mascot names like Tigers do not cause wrong logos.

After deploy, run the cron tick once to overwrite already-saved wrong logo URLs.
