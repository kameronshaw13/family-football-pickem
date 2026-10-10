# Arc-first full redesign (second experiment)

Branch: `experiment/arc-first-redesign-2026-10-09`

Arc-influenced original visual system that intentionally diverges from the live Pick'em design. This is **not an official Arc UI commissioned design**. It adapts Arc's design principles documented at https://uiarc.dev/docs/theming and https://uiarc.dev/docs/motion.

## New identity

- FIELDHOUSE compact product mark replaces original large photographic/wordmark header.
- Contextual editorial page intros on Picks, My Card, Standings, and Settings, with *real, read-only* counts from loaded app data.
- Rounded neutral containers, larger display text, calmer muted metadata, accent used primarily to show selection, layered sheets, restrained motion.
- Game-status dropdown replaced by Arc-derived animated segmented control (Upcoming / Live & locked / Final).
- Arc segmented control still powers Settings Light/Dark.
- A consistent mobile-first typography and component language across board, cards, bets, standings, game tracker, matchup preview, and Settings.
- Brand tokens and dark mode separately tuned.

## Guardrails

- Main branch and first Arc experiment remain available, untouched.
- Existing click handlers, locking rules, data fetching, side-bet logic, real-time updates, notification code, and backend routes are unchanged.
- Fixed bottom navigation positioning and safe-area geometry are not modified. Its appearance is redesigned.
- No new npm dependencies: preserves working Next.js 15/React 19 dependency versions and install lockfile.
- Arc UI's original source is MIT-licensed. See `components/arc/LICENSE`. This branch uses an adapted local segmented control, not the entire library.
- This Vercel preview may still connect to **production Supabase data**. Inspect visual screens only; do not send test picks or side bets.
- Vercel's build proves compilation, not cross-device UI verification. Inspect 320px, 375px, 430px, dark mode, long team names, full-page game tracker, and bottom nav before merge.

## Visual direction

Arc's own design system uses semantic surfaces and separate dark tokens, Geist/Inter-like typography, large card radii, generous white space, subtle status feedback, reduced motion support. We adapt those principles to a compact live sports product.

References:
- https://uiarc.dev/docs/theming
- https://uiarc.dev/docs/motion
- https://uiarc.dev/docs/installation
