This patch does three things:
1. adds the uploaded Chargers art as app/icon.png for the mobile app icon
2. removes the old dad account reference so the users are kameron, mike, quentin
3. adds a Bank tab with admin-editable winner/loser amounts and weekly settlement support

Important after applying:
- run the updated supabase/schema.sql in Supabase SQL Editor
- redeploy Vercel after pushing
- after the schema update, the Bank tab will show season totals and let the admin settle each completed week
