Code-only patch. No Supabase schema update is needed.

Fixes:
- Stops college logo matching from using mascot-only fuzzy matches, so Memphis will not pull Auburn just because both are Tigers.
- Uses stronger exact/location/team-name matching and returns no logo instead of the wrong logo when confidence is low.
- Removes faded opacity from closed game cards and places logos on a white circular background.

After deploy, run the cron tick once to overwrite existing wrong logo URLs in the games table.
