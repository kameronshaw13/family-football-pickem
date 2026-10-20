# Pick'em mobile UI, abbreviation, scores and odds audit

Date: October 20, 2026
Branch: `fix/mobile-scores-ui-audit-oct20` (PR #73)
Scope: All supported league pages, including Shaw, Friends and basketball; football GameTracker applies to NFL and CFB. No data migration or existing pick/bet settlement change.

## Issues verified in code and changes made

1. **Fixed bottom navigation** — Navigation uses CSS `position: fixed`, but multiple Side Bet/ledger updates triggered `stabilizeViewportAfterLayoutChange`, which ran `window.scrollTo` when content shrank. Visual viewport and resize listeners caused extra adjustments during mobile browser/keyboard changes. Removed all JS-induced document scroll corrections. Main navigation remains CSS-fixed with safe-area-aware height.
2. **GameTracker lag** — The modal stored the originally clicked `Game` object, even as the Pick Board received subsequent score updates. Open game details now use the refreshed `data.games` object. The display prioritizes live scoreboard scores and status from this source over ESPN's sometimes delayed detailed summary. Detailed plays continue fetching every 3 seconds. Confirmed final score takes priority on completion.
3. **GameTracker group routing** — The detail request previously sent only the session token; it now also passes `x-pickem-group` from the active league to match the API's group authorization and visibility rules.
4. **Live Side Bet matchups** — When the game is live, the existing team rows now show scores next to names, with the market/spread still right-aligned. The header includes down/field position when available and a GameTracker button. Pregame still shows Matchup Preview. This does not alter offers or their expiration logic.
5. **Abbreviations** — Corrected New Mexico to UNM, Northwestern to NU, and Texas A&M to TAMU in the central `teamNames.ts` map. Added regression tests. Full-length team names still take precedence until a compact label is required; no manual abbreviations inside the UI.
6. **Settings** — Use the same flat card/row geometry and spacing tokens as the rest of the app rather than circular icons and pill appearance toggles.
7. **Remove / close buttons** — Fixed size on the red X and close controls in all interaction states to avoid resizing on click.
8. **Separator dots** — Preserve current spacing/alignment; render as true circles using equal width/height and 50% radius, with the subpixel live clock dot normalized to 3px.

## Scores: actual current pipeline
- Client Pick Board calls `/api/live-scores` every **5 seconds** while relevant games are active. Endpoint is explicitly `no-store`, read-only, and consumes ESPN date schedules (4-second parsed cache), falling back to the exact ESPN event for missing scores. Finalization is handled separately.
- GameTracker polls `/api/game-tracker` every **3 seconds**, ESPN event **summary** endpoint (2-second async cache). Detail summary and event scoreboard can update at different moments, so score data and play-by-play are not guaranteed to arrive simultaneously. Keep a last-good payload if a transient summary request fails.
- No artificial final-score substitutions were introduced. If the source has no score, show unavailable rather than fabricate a final.

## Odds: actual current pipeline
- Football market source is **Action Network's DraftKings book feed**, using book id 15, not a direct DraftKings API connection. Action Network's league request cache is 5 seconds.
- Pick Board refreshes its market view about **30 seconds** while visible and Side Bets use `/api/side-bet-markets`; the server can persist provider-backed spreads in the database.
- Scheduled market sync uses `/api/cron/odds`, with `lib/marketSchedule.ts`: Tue 7:50 AM pre-open, Tue–Fri every 30 minutes 8:20 AM–8:50 PM Central, Sun/Mon 8:50 AM and Sat 8:50/9:50 PM. Schedule discovery uses ESPN canonical event ids, with provider time fallback for invalid/TBD start times.
- Basketball schedule and market refresh have a separate `refreshBasketballSlate` path.
- Live offer expiration follows score-change confirmation logic and must **never** be triggered by odds changes. No change was made to that logic.

## Limitations and verification
This is a repository/architecture audit, **not** a guarantee that the external feeds never delay, return incorrect or missing prices, or that every live game has immediate play-by-play. Authenticated end-to-end iOS PWA testing and live-game observation remain necessary to validate browser geometry and actual provider freshness.

Check 320/360/375/390/430px widths for navigation, Team/Scores alignment and GameTracker; check changing Side Bet filter, accepting/declining offers, keyboard opening/closing, light and dark modes. Confirm score consistency during a live game and exact final-score transitions. Run all GitHub Actions checks before merge.
