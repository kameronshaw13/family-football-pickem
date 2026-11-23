# CSS cascade ownership

The app is phone-first. Styling is maintained in one ordered global CSS cascade in `app/layout.tsx`.

| Stylesheet | Responsibility |
| --- | --- |
| `ui-foundations.css` | Global colors, spacing, typography, shape tokens, and base layout |
| `ui-components.css` | Reusable pick, bet, and general UI components |
| `ui-overlay-base.css` | Shared GameTracker / Matchup Preview overlay foundations |
| `ui-settings-base.css` | Settings and theme base styles |
| `ui-details.css` | Original legacy GameTracker, Matchup Preview, scoring, and box-score detail rules |
| `ui-unified-leagues.css` | Unified league header, Settings, activity, and subsequent base presentation refinements |
| `ui-detail-refinements.css` | Broadcast-style football and basketball GameTracker and Matchup Preview refinements |
| `ui-board-refinements.css` | Later day-by-day board, filters, date selectors, and final mobile detail refinements |
| `ui-experience.css` | Last-in-order app experience overrides |

## Safe changes

- Keep the import order above. The detail stylesheets are split at the original "Unified Pick’em home", "Unified broadcast-style GameTracker", and "Day-by-day Pick Board navigation" boundaries. The splits retain the previous rule order without reordering or changing CSS declarations.
- When improving GameTracker, Matchup Preview, or Pick Board, find the **last effective declaration** for the selector and property before editing. Avoid another end-of-file override; consolidate with the existing rule instead.
- Keep team-independent spacing, divider, header, label and shape contracts shared across sports. Do not restyle the bottom navigation, week selector, or sheet behavior incidentally.
- Root-level blocks whose every declaration is already repeated later for the exact same selector are safe candidates for deletion; preserve intentional narrower media-query overrides.
- Never change saved picks, bets, balances, odds, or scheduled jobs in a CSS-only cleanup.
- Before merging, run `npm run check:code` and `npm run build`, review the mobile layouts, and confirm the Vercel preview passes. These are not substitutes for live UI testing.

`npm run audit:css` protects the CSS import order, canonical tokens, and the single owner of previously consolidated detail rules **across all four** feature-owned detail files.

Recovery branch: `backup/pre-universal-cleanup-2026-11-23`. Latest work should be committed to a feature branch and merged into `main` only after checks pass.

## Repeated declaration cleanup (November 23, 2026)

The feature-owned `ui-unified-leagues.css`, `ui-detail-refinements.css` and `ui-board-refinements.css` styles now avoid repeated **root-level** declarations with the same complete selector, CSS property, and value. The consolidation removed 20, 56, and 9 such declarations respectively (85 total). A new `audit:css` assertion detects their reintroduction.

This rule is deliberately narrow: it does not remove declarations for different selectors, different values, important declarations, custom properties, or conditional `@media` and `@supports` rules. Later root-level declarations remain the owners. Retain intentional responsive overrides and verify the rendered appearance after future changes.
