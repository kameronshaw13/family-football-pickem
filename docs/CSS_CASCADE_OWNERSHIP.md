# CSS cascade ownership

The app is phone-first. Styling is maintained in one ordered global CSS cascade in `app/layout.tsx`.

| Stylesheet | Responsibility |
| --- | --- |
| `ui-foundations.css` | Global colors, spacing, typography, shape tokens, and base layout |
| `ui-components.css` | Reusable pick, bet, and general UI components |
| `ui-overlay-base.css` | Shared GameTracker / Matchup Preview overlay foundations |
| `ui-settings-base.css` | Settings and theme base styles |
| `ui-details.css` | Earlier detail and feature styles, including legacy score and matchup definitions |
| `ui-detail-refinements.css` | Later broadcast-style GameTracker, basketball, football, and board refinements |
| `ui-experience.css` | Last-in-order app experience overrides |

## Safe changes

- Keep the import order above. The two detail stylesheets were cut at the original "Unified broadcast-style GameTracker" rule boundary. Concatenating them at the time of extraction reproduced the prior CSS byte for byte.
- When improving GameTracker, Matchup Preview, or Pick Board, find the **last effective declaration** for the selector and property before editing. Avoid another end-of-file override; consolidate with the existing rule instead.
- Keep team-independent spacing, divider, header, label and shape contracts shared across sports. Do not restyle the bottom navigation, week selector, or sheet behavior incidentally.
- Root-level blocks whose every declaration is already repeated later for the exact same selector are safe candidates for deletion; preserve intentional narrower media-query overrides.
- Never change saved picks, bets, balances, odds, or scheduled jobs in a CSS-only cleanup.
- Before merging, run `npm run check:code` and `npm run build`, review the mobile layouts, and confirm the Vercel preview passes. These are not substitutes for live UI testing.

`npm run audit:css` protects the CSS import order, canonical tokens, and the single owner of previously consolidated detail rules **across both** detail files.

Recovery branch: `backup/pre-universal-cleanup-2026-11-23`. Latest work should be committed to a feature branch and merged into `main` only after checks pass.
