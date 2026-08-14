# Push notification setup

The Supabase notification tables are installed by `supabase/notifications.sql`. Web Push also requires one permanent VAPID key pair in Vercel.

## 1. Generate the keys once

From the project directory, run:

```bash
npx web-push generate-vapid-keys
```

Keep the private key secret. The same key pair should be reused for every deployment; changing it invalidates existing phone subscriptions.

## 2. Add Vercel environment variables

In Vercel, open Project Settings → Environment Variables and add these to Production, Preview, and Development:

- `VAPID_PUBLIC_KEY`: the generated public key
- `VAPID_PRIVATE_KEY`: the generated private key
- `VAPID_SUBJECT`: a contact URI such as `mailto:you@example.com`

Redeploy after saving the variables.

## 3. Enable each iPhone

1. Open the production site in Safari.
2. Use Share → Add to Home Screen if it is not already installed.
3. Open Family Pick'em from its Home Screen icon and sign in.
4. Open Rules → Push Notifications.
5. Tap Enable and then Allow in the iOS permission prompt.
6. Tap Test and lock the phone to verify delivery.

Permission and subscription are one-time per installed device. Notifications continue while the app is closed. Re-enable them after reinstalling the Home Screen app, clearing website data, changing the VAPID keys, or switching the device to another player account.

## Notification behavior

- My Card, League Cards, Sent offers, and the Side Bet Ledger clear their normal unread count after that exact section opens.
- A received side-bet offer remains active after viewing it and clears only when it is accepted, declined, canceled, expired, or otherwise closed.
- Notification rows use unique event keys so repeated results jobs cannot send the same final alert twice.
- Push delivery failures never block picks, side bets, grading, settlement, or bank updates.
