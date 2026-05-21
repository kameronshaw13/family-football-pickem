# Ready mode setup

After applying the patch and pushing to Vercel, run the latest SQL file:

```bash
cd ~/Downloads/family-football-pickem
cat supabase/schema.sql | pbcopy
```

Paste that into Supabase SQL Editor and click Run.

Then redeploy Vercel.

The app no longer uses demo mode. If you are not signed in, it sends you to `/login`.

## Usernames

- kameron
- dad
- mike
- quentin

Each person uses the **First time** tab to create their password. After that, they sign in with the same username and password.
