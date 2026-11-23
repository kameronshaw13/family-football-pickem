# Pick'em UI architecture and rollback point

**Pre-cleanup source snapshot:** [backup/pre-universal-cleanup-2026-11-23](https://github.com/kameronshaw13/family-football-pickem/tree/backup/pre-universal-cleanup-2026-11-23) at `f07842fb6df2c6027c36af89d9f550f77a964ec7`.

This is a Git source-code snapshot, not a Supabase database backup.

## One-owner design rules

| Concern | Authoritative owner | Keep distinct |
| --- | --- | --- |
| Global spacing, flat radii, colors | `app/ui-foundations.css` `:root` | Dark/light palette substitutions |
| Matchup header, row, divider semantic variables | `--matchup-*` tokens in foundations, light values in `app/ui-experience.css` | Selected and graded outcomes |
| All-sport matchup DOM frame | `components/MatchupCardFrame.tsx` | Picks and Side Bets handle their own actions |
| Original GameTracker and Matchup Preview baseline | `app/ui-overlay-base.css` | Later responsive/detail refinements in `ui-details.css` |
| Settings and original theme baseline | `app/ui-settings-base.css` | Final light-theme adjustments in `ui-experience.css` |
| Popup title-bar tokens and close control | `--detail-header-*`, `GameDetailClose` | Popup body, sport-specific information |
| Notification count geometry | `NotificationBadge` and foundation CSS | Badge placement by navigation/menu/tab |
| Main navigation | `PersistentAppChrome` and `PrimaryBottomNav` | League header wordmarks |
| App loading cache selection, retry policy and basketball line continuity | `lib/appLoadClient.ts` | Loading indicators, auth redirect, session validation and cancellation stay in app coordinator |
| Pick save transport and signed-in player's current-week cache replacement | `lib/pickSaveClient.ts` | Server validates pick limits, lock status and scoring; other users/weeks preserved |
| Notification HTTP requests, count normalization and optimistic read calculations | `lib/notificationClient.ts` | Polling frequency, navigation and persisted read state stay in app/API |
| Side Bet API request URL, headers, and mutation body transport | `lib/sideBetNetwork.ts` | Locking, request sequencing, polling cadence and state remain in app coordinator |
| Side Bet refresh fingerprints, stale response ordering and live acceptance payloads | `lib/sideBetRefreshState.ts` | Network scheduling, mutations and cache writes stay in the app coordinator |
| Read-only Bank standings, weekly bank amounts and accepted bet exposure | `lib/bankPresentation.ts` | Does not settle bets or modify persisted credits |
| Pick Board league filtering, reschedule replacement and final dedup | `lib/boardGameFiltering.ts` | Conference predicates and dog-value rules delegated to sport-aware presentation |
| Browser league/week selection and Side Bet cached snapshots | `lib/clientLeagueContext.ts` | Batch actions require matching week; display overlays allow fallback |
| Pick limits and Side Bet policies | Server-side group season rules | Different leagues and week overrides |

## UI invariants

1. In light mode, cream game headers and neutral white team rows are shared across CFB, NFL, CBB and NBA; gray strips exist between game groups.
2. A selected pick, graded outcome, blocked team or live game may be styled differently for meaning.
3. Closing/reopening a panel must not shift the fixed bottom navigation.
4. Header, popup and matchup dividers are single thin rules, not stacked shadows and borders.
5. The league's saved data, existing Side Bets, payouts, odds sources and week overrides are **not** changed by this refactor.

## Safe continuation

When working on a new feature, change the owning component/token rather than appending an overriding rule near the end of `ui-details.css`. `app/ui-experience.css` is the final owner for light-theme colors, chrome, Pick Board/Side Bets surfaces and latest popup layout. `ui-overlay-base.css` owns the original GameTracker/Matchup Preview styles; `ui-settings-base.css` owns original Settings/theme styles; `ui-details.css` retains later refinements loaded in their historic order. Verify `npm run check:code` (including the UI ownership guard) and `npm run build` before merging. The standalone `tests/uiDesignContract.test.ts` checks the styling and component contracts.

For rollback, create a new branch from the backup SHA and restore the required source files or deploy that SHA. Do not overwrite user database changes when reverting UI code.

## Future changes: clean-code workflow

1. **Locate the owner first.** Look up this table and the current component before changing CSS or business logic. Edit the existing declaration instead of creating another selector with stronger specificity or `!important`.
2. **One source of truth.** Shared typography, colors, geometry and spacing belong to existing tokens. A new reusable UI pattern gets a small named component and a test; per-league variation belongs in data or explicit props.
3. **Separate appearance from game rules.** Presentation changes must not alter existing picks, odds sync, Side Bets, lock times, bank or payout calculations. For rule changes add tests and database migrations deliberately.
4. **Run checks before the single PR:** `npm run check:code && npm run build`. The `audit:ui-ownership` check enforces correct light-theme ownership and import order; the existing CSS integrity audit checks shared radii and token uniqueness.
5. **Review on phone first.** Verify both themes, open/locked weeks, selected and graded games, date scrollers, popups, keyboard, and non-moving bottom nav across CFB/NFL/CBB/NBA.
6. **Merge a single tested PR.** Keep a rollback ref at every major milestone. No needless test deploys or separate PRs for minor refinements.

This is a living policy, not a blanket prohibition on refactoring old selectors. For new styles, prefer improving the owned rules and deleting the superseded rule in the same change rather than further lengthening the cascade.
