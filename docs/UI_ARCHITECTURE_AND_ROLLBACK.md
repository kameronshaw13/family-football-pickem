# Pick'em UI architecture and rollback point

**Pre-cleanup source snapshot:** [backup/pre-universal-cleanup-2026-11-23](https://github.com/kameronshaw13/family-football-pickem/tree/backup/pre-universal-cleanup-2026-11-23) at `f07842fb6df2c6027c36af89d9f550f77a964ec7`.

This is a Git source-code snapshot, not a Supabase database backup.

## One-owner design rules

| Concern | Authoritative owner | Keep distinct |
| --- | --- | --- |
| Global spacing, flat radii, colors | `app/ui-foundations.css` `:root` | Dark/light palette substitutions |
| Matchup header, row, divider semantic variables | `--matchup-*` tokens in foundations, light values in details | Selected and graded outcomes |
| All-sport matchup DOM frame | `components/MatchupCardFrame.tsx` | Picks and Side Bets handle their own actions |
| Popup title-bar tokens and close control | `--detail-header-*`, `GameDetailClose` | Popup body, sport-specific information |
| Notification count geometry | `NotificationBadge` and foundation CSS | Badge placement by navigation/menu/tab |
| Main navigation | `PersistentAppChrome` and `PrimaryBottomNav` | League header wordmarks |
| Browser league/week selection and Side Bet cached snapshots | `lib/clientLeagueContext.ts` | Batch actions require matching week; display overlays allow fallback |
| Pick limits and Side Bet policies | Server-side group season rules | Different leagues and week overrides |

## UI invariants

1. In light mode, cream game headers and neutral white team rows are shared across CFB, NFL, CBB and NBA; gray strips exist between game groups.
2. A selected pick, graded outcome, blocked team or live game may be styled differently for meaning.
3. Closing/reopening a panel must not shift the fixed bottom navigation.
4. Header, popup and matchup dividers are single thin rules, not stacked shadows and borders.
5. The league's saved data, existing Side Bets, payouts, odds sources and week overrides are **not** changed by this refactor.

## Safe continuation

When working on a new feature, change the owning component/token rather than appending an overriding rule near the end of `ui-details.css`. Verify `npm run check:code` and `npm run build` before merging. The standalone `tests/uiDesignContract.test.ts` checks the styling and component contracts.

For rollback, create a new branch from the backup SHA and restore the required source files or deploy that SHA. Do not overwrite user database changes when reverting UI code.
