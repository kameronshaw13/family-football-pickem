This patch switches the app to true in-app username/password accounts.

Users:
- Kameron
- Mike
- Quentin

The login screen starts on Create Account. Each person picks their name and creates their own password.
The session token is stored on the device, so the app stays logged in unless the user taps sign out, clears site data, or deletes/re-adds the home screen app.

After applying the code patch, run supabase/schema.sql in Supabase SQL Editor. The schema resets profiles, picks, and bank entries so the accounts can be created fresh.
